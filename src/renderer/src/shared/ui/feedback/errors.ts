const fallback = 'Something went wrong. Try again.'
const httpDump = /(?:^|\s)(?:(?:request|response) )?headers:\s*[{[]/i

/** A short explanation for an inline message or toast. */
export function errorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : typeof e === 'string' ? e : ''
  const message = raw
    .replace(/^(Error: )?(Error invoking remote method '[^']+': )?(\w*Error: )?/, '')
    .trim()
  if (/\b(?:ENOENT|ENOTDIR)\b/.test(message)) return 'A required file or folder is missing.'
  if (/\b(?:EACCES|EPERM)\b/.test(message))
    return 'Builder Studio couldn’t access a file or folder.'
  if (!message || httpDump.test(message) || /^[{[]|^Traceback\b/.test(message)) return fallback
  const line = message.split(/\r?\n/, 1)[0]
  if (!line || /\S{100}/.test(line)) return fallback
  return line.length <= 160 ? line : `${line.slice(0, 160).replace(/\s+\S*$/, '')}…`
}

/** Diagnostic text for a bug report, without HTTP header dumps. */
export function errorDetails(e: unknown): string {
  let text: string
  try {
    text =
      e instanceof Error
        ? e.stack?.includes(e.message)
          ? e.stack
          : `${e.message}\n${e.stack ?? ''}`.trim()
        : typeof e === 'string'
          ? e
          : (JSON.stringify(e, null, 2) ?? String(e))
  } catch {
    text = String(e)
  }
  const headers = text.search(httpDump)
  return headers < 0 ? text : `${text.slice(0, headers)}\n[HTTP headers removed]`
}
