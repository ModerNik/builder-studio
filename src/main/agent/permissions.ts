// The embedded agent's permission rules. The CLI asks (canUseTool) for what its own settings don't allow; the
// app answers from the user's "Always" rules per build, kept in settings.json as `Tool` or `Tool(prefix)`.
// Some calls never get an Always: git push, deletes outside builds/*/out/, and anything outside the repo.
import { isAbsolute, posix, relative, resolve } from 'path'

const FILE_TOOLS = new Set([
  'Read',
  'Edit',
  'Write',
  'MultiEdit',
  'NotebookEdit',
  'Glob',
  'Grep',
  'LS'
])
// ; & | < > ` $( and newlines: a prefix rule must not cover a second command
const CHAINED = /[;&|<>`\n\r]|\$\(/
const DELETE_VERB =
  /(?:^|\s)(rm|rmdir|del|erase|rd|unlink|remove-item|ri|git\s+rm|git\s+clean)(?=\s|$)/i
const DELETE_CODE = /\b(rmtree|os\.remove|os\.unlink|unlinkSync|rmSync|\.unlink\(|send2trash)\b/
const OUT_PATH = /^(\.\/)?builds\/[\w.-]+(\/[\w.-]+)*\/out\/[^\s]+$/
const INTERPRETER_FLAG = /^(-c|-e|-Command|\/c|-EncodedCommand)$/i

const filePath = (input: Record<string, unknown>): string | undefined => {
  const p = input.file_path ?? input.notebook_path ?? input.path
  return typeof p === 'string' && p ? p : undefined
}

/** Git Bash's /d/Code/... as D:/Code/... */
const fromPosixDrive = (p: string): string =>
  p.replace(/^\/([a-zA-Z])(?=\/|$)/, (_, d: string) => `${d.toUpperCase()}:`)

/** Whether `p` (absolute, or relative to the repo) lies inside the repo. */
export function insideRepo(repo: string, p: string): boolean {
  const r = relative(resolve(repo), resolve(repo, fromPosixDrive(p)))
  return !r.startsWith('..') && !isAbsolute(r)
}

const unquote = (t: string): string => t.replace(/^["']|["']$/g, '')

/** Why this call may never be allowed by a stored rule (it always shows a card without "Always"), or null. */
export function guard(tool: string, input: Record<string, unknown>, repo: string): string | null {
  if (FILE_TOOLS.has(tool)) {
    const p = filePath(input)
    return p && !insideRepo(repo, p) ? 'outside the workspace' : null
  }
  if (tool !== 'Bash') return null
  const cmd = String(input.command ?? '')
  if (/\bgit\s+push\b/.test(cmd)) return 'git push'
  if (DELETE_CODE.test(cmd)) return 'deletes files from code'
  const tokens = cmd.split(/\s+/).filter(Boolean).map(unquote)
  for (const t of tokens) {
    const looksAbsolute = /^[a-zA-Z]:[\\/]/.test(t) || /^\/[a-zA-Z]\//.test(t)
    if (
      t.startsWith('~') ||
      ((looksAbsolute || t.split(/[\\/]/).includes('..')) && !insideRepo(repo, t))
    )
      return 'a path outside the workspace'
  }
  // every delete must name only files under builds/*/out/
  for (const part of cmd.split(/&&|\|\||[;|\n]/)) {
    const m = DELETE_VERB.exec(part)
    if (!m) continue
    const targets = part
      .slice(m.index + m[0].length)
      .split(/\s+/)
      .filter((t) => t && !t.startsWith('-'))
      .map(unquote)
    if (!targets.length || !targets.every((t) => OUT_PATH.test(t.replace(/\\/g, '/'))))
      return 'deletes outside builds/*/out/'
  }
  return null
}

/** The rule "Always" would store for this call, or null when no safe prefix exists. */
export function suggestRule(
  tool: string,
  input: Record<string, unknown>,
  repo: string
): string | null {
  if (guard(tool, input, repo)) return null
  if (tool === 'Bash') {
    const cmd = String(input.command ?? '').trim()
    if (!cmd || CHAINED.test(cmd)) return null
    const words: string[] = []
    for (const w of cmd.split(/\s+/)) {
      if (w.startsWith('-') || words.length === 3) break
      words.push(w)
    }
    const prefix = words.join(' ')
    return words.length >= 2 ? `Bash(${prefix})` : null
  }
  if (FILE_TOOLS.has(tool)) {
    const p = filePath(input)
    if (!p) return tool
    const rel = relative(resolve(repo), resolve(repo, fromPosixDrive(p)))
      .split('\\')
      .join('/')
    const dir = posix.dirname(rel)
    return dir === '.' ? null : `${tool}(${dir}/)`
  }
  return tool
}

/** Whether a stored rule covers this call. Never true for a guarded call. */
export function ruleAllows(
  rule: string,
  tool: string,
  input: Record<string, unknown>,
  repo: string
): boolean {
  if (guard(tool, input, repo)) return false
  const m = /^([\w-]+)(?:\((.+)\))?$/.exec(rule)
  if (!m || m[1] !== tool) return false
  const prefix = m[2]
  if (prefix === undefined) return tool !== 'Bash' && !FILE_TOOLS.has(tool)
  if (tool === 'Bash') {
    const cmd = String(input.command ?? '').trim()
    if (
      CHAINED.test(cmd) ||
      prefix.split(/\s+/).length < 2 ||
      prefix.split(/\s+/).some((w) => INTERPRETER_FLAG.test(w))
    )
      return false
    return cmd === prefix || cmd.startsWith(prefix + ' ')
  }
  const p = filePath(input)
  if (!p) return false
  const rel = relative(resolve(repo), resolve(repo, fromPosixDrive(p)))
    .split('\\')
    .join('/')
  return rel.startsWith(prefix)
}
