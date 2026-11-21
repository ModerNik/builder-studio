// The app's agent tools, one set of handlers for two hosts:
// - the companion MCP server for external agents (Claude Code, Codex, Claude Desktop): Streamable HTTP on 127.0.0.1
//   only, stateless (a fresh server per request), tools guide, show, sheet, status, request_review;
// - the embedded agent's in-process server (agent.ts): show_in_viewer, show_sheet, status, request_review, log_round.
// request_review waits until the user saves or declines the round.
import { createServer, type Server } from 'http'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'
import { MCP_PORT, type ReviewRequest, type SavedRound } from '@shared/api'

const HOSTS = new Set([`127.0.0.1:${MCP_PORT}`, `localhost:${MCP_PORT}`])
const VERSION = /^builds\/((?:_[\w.-]+\/)?[\w.-]+)\/out\/[\w.-]+\.litematic$/
const SHEET = /^builds\/((?:_[\w.-]+\/)?[\w.-]+)\/out\/(?:[\w.-]+\/)*[\w.-]+\.png$/

export interface McpDeps {
  show(path: string, build: string): void | Promise<void>
  sheet(path: string, build: string): void | Promise<void> // throws if the file is missing
  status(): unknown
  versions(build: string): Promise<string[]> // repo-relative .litematic paths; throws for an unknown build
  ask(req: Omit<ReviewRequest, 'id'>, signal?: AbortSignal): Promise<SavedRound | null>
  logRound(build: string, markdown: string): Promise<void>
}

type Result = { content: { type: 'text'; text: string }[] }
const text = (v: unknown): Result => ({
  content: [{ type: 'text', text: typeof v === 'string' ? v : JSON.stringify(v, null, 2) }]
})

export const SHAPES = {
  show: { path: z.string() },
  sheet: { path: z.string() },
  request_review: {
    build: z.string(),
    question: z.string(),
    variants: z.array(z.string()).min(1).max(4),
    parts: z.array(z.string()).optional()
  },
  log_round: { build: z.string(), markdown: z.string() }
}

export const DESCRIPTIONS = {
  show: 'Open a .litematic in Builder Studio (the 3D view of its build). path: repo-relative, builds/<name>/out/<file>.litematic.',
  sheet:
    'Show a render sheet PNG to the user in Builder Studio, without loading it into your context. path: repo-relative, builds/<name>/out/…/<file>.png.',
  status:
    'What the user has open in Builder Studio: build, version, tab, picked block, selected parts (op names from the Parts tab), ' +
    'the review in progress, running jobs and reviews waiting.',
  request_review:
    'Ask the user to review variants in Builder Studio. Blocks until they press Save and send (returns the saved ' +
    'builds/<build>/review/round_N.json: pick, approved parts, notes, pins on blocks and sheets) or Decline (returns "declined"). ' +
    'variants: file stems in builds/<build>/out/ (tower_A) or repo-relative .litematic paths. parts: names offered as "approve" chips.',
  log_round:
    'Append a round gist to the end of the process log in builds/<build>/DESIGN.md. markdown starts with a "### " heading. ' +
    'Refused if it would change the Status block.'
}

type Args<K extends keyof typeof SHAPES> = z.infer<z.ZodObject<(typeof SHAPES)[K]>>

/** The tool handlers both servers register. */
export function handlers(d: McpDeps): {
  show(args: Args<'show'>): Promise<Result>
  sheet(args: Args<'sheet'>): Promise<Result>
  status(): Promise<Result>
  request_review(args: Args<'request_review'>, signal?: AbortSignal): Promise<Result>
  log_round(args: Args<'log_round'>): Promise<Result>
} {
  return {
    async show({ path }: Args<'show'>): Promise<Result> {
      const m = VERSION.exec(path)
      if (!m || !(await d.versions(m[1])).includes(path))
        throw new Error(`no such version: ${path}`)
      await d.show(path, m[1])
      return text(`showing ${path}`)
    },
    async sheet({ path }: Args<'sheet'>): Promise<Result> {
      const m = SHEET.exec(path)
      if (!m || path.split('/').includes('..'))
        throw new Error(`not a sheet under builds/<name>/out/: ${path}`)
      await d.sheet(path, m[1])
      return text(`showing ${path}`)
    },
    async status(): Promise<Result> {
      return text(d.status())
    },
    async request_review(
      { build, question, variants, parts }: Args<'request_review'>,
      signal?: AbortSignal
    ): Promise<Result> {
      const have = await d.versions(build)
      const paths = variants.map((v) =>
        v.includes('/') ? v : `builds/${build}/out/${v}.litematic`
      )
      const missing = paths.filter((p) => !have.includes(p))
      if (missing.length) throw new Error(`not in builds/${build}/out: ${missing.join(', ')}`)
      const saved = await d.ask({ build, question, variants: paths, parts: parts ?? [] }, signal)
      return text(saved ? { path: saved.path, round: saved.round } : 'declined')
    },
    async log_round({ build, markdown }: Args<'log_round'>): Promise<Result> {
      if (!/^###\s/.test(markdown.trimStart()))
        throw new Error('markdown must start with a "### " heading')
      await d.logRound(build, markdown.trim())
      return text(`appended to builds/${build}/DESIGN.md`)
    }
  }
}

const INSTRUCTIONS =
  'Builder Studio is the desktop app where the user designs Minecraft builds (Python drawings exported as ' +
  'schematics, checked by render sheets). Call guide first: it gives the workspace (use it as your cwd), the ' +
  'Python command and the build workflow. Then use show and sheet to put results in front of the user, status to ' +
  'see what they have open, and request_review to get their pick and notes on variants.'

function tools(d: McpDeps, guide: () => string): McpServer {
  const h = handlers(d)
  const s = new McpServer(
    { name: 'builder-studio', version: '0.3.0' },
    { instructions: INSTRUCTIONS }
  )
  s.registerTool(
    'guide',
    {
      description:
        'How to work in Builder Studio: absolute workspace and runtime paths, the Python command, and the ' +
        'build workflow and its rules. Read it before you start a build.'
    },
    async () => text(guide())
  )
  s.registerTool('show', { description: DESCRIPTIONS.show, inputSchema: SHAPES.show }, h.show)
  s.registerTool('sheet', { description: DESCRIPTIONS.sheet, inputSchema: SHAPES.sheet }, h.sheet)
  s.registerTool('status', { description: DESCRIPTIONS.status }, h.status)
  s.registerTool(
    'request_review',
    { description: DESCRIPTIONS.request_review, inputSchema: SHAPES.request_review },
    async (args, extra) => {
      // progress pings keep clients that reset their timeout on progress waiting for the user
      const token = extra._meta?.progressToken
      let n = 0
      const ping =
        token !== undefined
          ? setInterval(
              () =>
                void extra
                  .sendNotification({
                    method: 'notifications/progress',
                    params: { progressToken: token, progress: ++n, message: 'waiting for the user' }
                  })
                  .catch(() => {}),
              20_000
            )
          : undefined
      try {
        // shortcut: a client that hangs up leaves the request open in the app until the user answers it
        return await h.request_review(args)
      } finally {
        clearInterval(ping)
      }
    }
  )
  return s
}

export function startMcp(d: McpDeps, guide: () => string): Server {
  const http = createServer((req, res) => {
    // DNS rebinding and browser pages: our own host names only, and no Origin at all (the agent is not a browser)
    if (!HOSTS.has(req.headers.host ?? '') || req.headers.origin !== undefined) {
      res.writeHead(403).end('forbidden')
      return
    }
    if (req.url?.split('?')[0] !== '/mcp') {
      res.writeHead(404).end()
      return
    }
    const server = tools(d, guide)
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
    res.on('close', () => {
      void transport.close()
      void server.close()
    })
    server
      .connect(transport)
      .then(() => transport.handleRequest(req, res))
      .catch((e) => {
        if (!res.headersSent) res.writeHead(500).end(String(e))
      })
  })
  http.on('error', (e) => console.error(`MCP server on 127.0.0.1:${MCP_PORT}: ${e.message}`))
  http.listen(MCP_PORT, '127.0.0.1')
  return http
}
