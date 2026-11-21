// Minimal stdio JSON-RPC transport, checked against codex-cli 0.166.0-alpha.5.1's generated schema.
import { execFile, spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { createInterface } from 'readline'
import { z } from 'zod'

export type RpcMessage = { method: string; params: Record<string, unknown>; id?: string | number }
export interface CodexConnection {
  initialized(): void
  request<T>(method: string, params: unknown): Promise<T>
  respond(id: string | number, result: unknown): void
  reject(id: string | number, message: string): void
  close(): void
}

const Envelope = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  method: z.string().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
  result: z.unknown().optional(),
  error: z.object({ message: z.string() }).passthrough().optional()
})

export class CodexRpc implements CodexConnection {
  private process: ChildProcessWithoutNullStreams
  private next = 0
  private ended = false
  private stderr = ''
  private pending = new Map<
    number,
    { resolve(v: unknown): void; reject(e: Error): void; timer: NodeJS.Timeout }
  >()

  constructor(
    file: string,
    args: string[],
    options: { cwd: string; env: NodeJS.ProcessEnv },
    receive: (message: RpcMessage) => void,
    failed: (error: Error) => void
  ) {
    this.process = spawn(file, args, { ...options, windowsHide: true, stdio: 'pipe' })
    const fail = (e: Error): void => {
      if (this.ended) return
      this.close(e)
      failed(e)
    }
    this.process.on('error', fail)
    this.process.stdin.on('error', fail)
    this.process.on('exit', (code) =>
      fail(
        new Error(
          `Codex app-server exited (${code}). Check its executable and provider settings.${this.stderr ? `\n${this.stderr}` : ''}`
        )
      )
    )
    this.process.stderr.on('data', (data: Buffer) => {
      this.stderr = (this.stderr + data.toString('utf8'))
        .slice(-2000)
        .replace(/Bearer\s+\S+|sk-[\w-]+|eyJ[\w.-]+/gi, '[redacted]')
    })
    createInterface({ input: this.process.stdout }).on('line', (line) => {
      if (this.ended) return
      try {
        const m = Envelope.parse(JSON.parse(line))
        if (m.method) receive({ method: m.method, params: m.params ?? {}, id: m.id })
        else if (typeof m.id === 'number') {
          const pending = this.pending.get(m.id)
          if (!pending) return
          this.pending.delete(m.id)
          clearTimeout(pending.timer)
          if (m.error) pending.reject(new Error(m.error.message))
          else pending.resolve(m.result)
        }
      } catch (e) {
        fail(
          new Error(
            `Invalid Codex app-server message: ${e instanceof Error ? e.message : String(e)}`
          )
        )
      }
    })
  }

  private write(message: unknown): void {
    if (this.ended) throw new Error('Codex app-server is closed')
    this.process.stdin.write(JSON.stringify(message) + '\n')
  }

  async request<T>(method: string, params: unknown): Promise<T> {
    const id = ++this.next
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Codex ${method} timed out. Check the provider and retry.`))
      }, 30_000)
      this.pending.set(id, { resolve: (v) => resolve(v as T), reject, timer })
      try {
        this.write({ id, method, params })
      } catch (e) {
        this.pending.delete(id)
        clearTimeout(timer)
        reject(e)
      }
    })
  }

  initialized(): void {
    this.write({ method: 'initialized', params: {} })
  }
  respond(id: string | number, result: unknown): void {
    this.write({ id, result })
  }
  reject(id: string | number, message: string): void {
    this.write({ id, error: { code: -32601, message } })
  }

  close(error = new Error('Codex app-server closed')): void {
    if (this.ended) return
    this.ended = true
    for (const p of this.pending.values()) {
      clearTimeout(p.timer)
      p.reject(error)
    }
    this.pending.clear()
    this.process.stdin.end()
    if (process.platform === 'win32' && this.process.pid)
      execFile(
        'taskkill.exe',
        ['/pid', String(this.process.pid), '/T', '/F'],
        { windowsHide: true },
        () => {}
      )
    else this.process.kill()
  }
}
