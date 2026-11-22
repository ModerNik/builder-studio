import { existsSync, readFileSync } from 'fs'
import { isAbsolute, join } from 'path'
import { z } from 'zod'
import type { Settings } from '@shared/api'
import { findCodex, findGitBash } from '../runtime/detect'

const SHELL_WRAPPER = /\.(cmd|bat|ps1)$/i

export function providerExecutable(s: Settings): string {
  if (s.codex) {
    if (!isAbsolute(s.codex) || !existsSync(s.codex) || SHELL_WRAPPER.test(s.codex))
      throw new Error(
        `The Codex path in Settings (${s.codex}) is not a codex.exe that exists. Select codex.exe, or clear the field to find Codex automatically.`
      )
    return s.codex
  }
  const found = findCodex()
  if (!found)
    throw new Error(
      'Codex is not installed on this PC. Install the Codex app or run npm install -g @openai/codex, then check again. Ollama also runs through Codex.'
    )
  return found
}

/** Returns Git Bash on Windows (null elsewhere). MinGit is deliberately not treated as Git Bash. */
export function claudePrerequisites(s: Settings): string | null {
  if (!s.claude)
    throw new Error(
      'Claude Code is not installed on this PC. Install it from claude.com/claude-code, sign in with claude auth login, then check again.'
    )
  if (!isAbsolute(s.claude) || !existsSync(s.claude) || SHELL_WRAPPER.test(s.claude))
    throw new Error(
      `The Claude Code path in Settings (${s.claude}) is not a claude.exe that exists. Select claude.exe, or clear the field to find Claude Code automatically.`
    )
  if (process.platform !== 'win32') return null
  if (s.gitBash) {
    if (!isAbsolute(s.gitBash) || !existsSync(s.gitBash))
      throw new Error(
        `The Git Bash path in Settings (${s.gitBash}) does not exist. Select bash.exe from Git for Windows, or clear the field to find it automatically.`
      )
    return s.gitBash
  }
  const bash = findGitBash(s.git)
  if (!bash)
    throw new Error(
      'Claude Code on Windows needs Git for Windows (git-scm.com), which includes Git Bash. Install it, or select its bash.exe in Settings. The Git that Builder Studio installs (MinGit) has no Bash.'
    )
  return bash
}

export function ollamaEndpoint(value: string): URL {
  const url = new URL(value)
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  )
    throw new Error(
      'Ollama endpoint must be an http(s) server origin without credentials, a path, query or fragment.'
    )
  return url
}

export async function ollamaModels(s: Settings): Promise<string[]> {
  const url = ollamaEndpoint(s.ollamaEndpoint)
  const response = await fetch(new URL('/api/tags', url), {
    signal: AbortSignal.timeout(5000),
    redirect: 'error'
  }).catch((e) => {
    throw new Error(
      `Ollama is not reachable at ${url.origin}. Start Ollama, or check the endpoint in Settings.`,
      { cause: e }
    )
  })
  if (!response.ok)
    throw new Error(
      `Ollama /api/tags returned HTTP ${response.status}. Check the endpoint in Settings.`
    )
  const data = (await response.json()) as { models?: { name: string }[] }
  if (!Array.isArray(data.models) || data.models.some((m) => typeof m.name !== 'string'))
    throw new Error('Ollama returned an invalid model list.')
  return data.models.map((m) => m.name)
}

/** Process-only overrides and app-owned CODEX_HOME; never write the user's global config. */
export function codexArgs(s: Settings, local: boolean): string[] {
  const config: Record<string, unknown> = {
    model_provider: local ? 'builder_ollama' : 'openai',
    cli_auth_credentials_store: 'file',
    approval_policy: 'on-request',
    approvals_reviewer: 'user',
    sandbox_mode: 'workspace-write',
    'sandbox_workspace_write.network_access': false,
    'sandbox_workspace_write.writable_roots': [s.workspace, s.cache],
    'sandbox_workspace_write.exclude_tmpdir_env_var': true,
    'sandbox_workspace_write.exclude_slash_tmp': true,
    'windows.sandbox': 'unelevated',
    'shell_environment_policy.inherit': 'all',
    'features.multi_agent': false,
    'features.default_mode_request_user_input': true,
    web_search: 'disabled'
  }
  if (local)
    Object.assign(config, {
      model: s.ollamaModel,
      'model_providers.builder_ollama.name': 'Builder Studio Ollama',
      'model_providers.builder_ollama.base_url': new URL('/v1', ollamaEndpoint(s.ollamaEndpoint))
        .href,
      'model_providers.builder_ollama.wire_api': 'responses',
      'model_providers.builder_ollama.requires_openai_auth': false,
      'model_providers.builder_ollama.supports_websockets': false
    })
  return ['app-server', '--listen', 'stdio://', ...overrides(config)]
}

// JSON strings, booleans and string arrays here are also valid TOML values; spawn has no shell.
const overrides = (config: Record<string, unknown>): string[] =>
  Object.entries(config).flatMap(([key, value]) => ['-c', `${key}=${JSON.stringify(value)}`])

const Key = z.string().regex(/^[\w-]+$/)
const McpConfig = z.object({
  mcpServers: z
    .record(
      Key,
      z.union([
        z.object({
          type: z.literal('stdio').optional(),
          command: z.string().min(1),
          args: z.array(z.string()).optional(),
          env: z.record(z.string().regex(/^\w+$/), z.string()).optional()
        }),
        z.object({
          type: z.enum(['http', 'sse']).optional(),
          url: z.url({ protocol: /^https?$/ }),
          headers: z.record(Key, z.string()).optional()
        })
      ])
    )
    .default({})
})

/** Workspace `.mcp.json` servers as `-c` overrides; env and header values travel in `env`, never argv. */
export function codexMcp(workspace: string): {
  args: string[]
  env: Record<string, string>
  error: string | null
} {
  const file = join(workspace, '.mcp.json')
  if (!workspace || !existsSync(file)) return { args: [], env: {}, error: null }
  try {
    const { mcpServers } = McpConfig.parse(JSON.parse(readFileSync(file, 'utf8')))
    const config: Record<string, unknown> = {}
    const env: Record<string, string> = {}
    const put = (key: string, value: string): void => {
      if (key in env && env[key] !== value)
        throw new Error(`${key} is set twice with different values`)
      env[key] = value
    }
    for (const [n, server] of Object.entries(mcpServers)) {
      const at = `mcp_servers.${n}`
      if ('command' in server) {
        config[`${at}.command`] = server.command
        if (server.args) config[`${at}.args`] = server.args
        const vars = Object.entries(server.env ?? {})
        for (const [k, v] of vars) put(k, v)
        if (vars.length) config[`${at}.env_vars`] = vars.map(([k]) => k)
      } else {
        // shortcut: sse servers are handed to Codex as streamable HTTP, add a transport key if Codex grows one
        config[`${at}.url`] = server.url
        Object.entries(server.headers ?? {}).forEach(([header, v], i) => {
          const name = `MCB_MCP_${n.toUpperCase().replace(/-/g, '_')}_${i}`
          put(name, v)
          config[`${at}.env_http_headers.${header}`] = name
        })
      }
    }
    return { args: overrides(config), env, error: null }
  } catch (e) {
    const why = e instanceof z.ZodError ? z.prettifyError(e) : e instanceof Error ? e.message : e
    return { args: [], env: {}, error: `${file} is invalid, so its MCP servers are off: ${why}` }
  }
}
