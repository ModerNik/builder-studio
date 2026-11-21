// PythonBridge: one long-lived `python -u -m mcb.bridge` speaking NDJSON. Stops when idle; respawns on the next call after that or a crash.
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { lineSplitter } from '@shared/events'
import { killTree } from './jobs'
import { pythonEnv, resolved } from '../app/settings'
import { BridgeProgressSchema, type BridgeProgress } from '@shared/api'
import type { Settings } from '@shared/api'

interface Pending {
  resolve: (data: unknown) => void
  reject: (e: Error) => void
  progress?: (data: BridgeProgress) => void
}

const MAX_LOG = 500
const IDLE_MS = 5 * 60_000 // an unused worker keeps Python and its imports in RAM

export class PythonBridge {
  private proc: ChildProcessWithoutNullStreams | null = null
  private pending = new Map<number, Pending>()
  private next = 1
  private idle: NodeJS.Timeout | undefined
  readonly log: string[] = [] // stderr: library print()s and tracebacks

  get busy(): boolean {
    return this.pending.size > 0
  }

  constructor(
    private readonly singleThreaded = false,
    private readonly settings: () => Settings = resolved,
    private readonly idleMs = IDLE_MS
  ) {}

  private note(line: string): void {
    this.log.push(line)
    if (this.log.length > MAX_LOG) this.log.shift()
  }

  /** Restart the idle countdown; it runs only while a worker is up with nothing pending. */
  private rest(): void {
    clearTimeout(this.idle)
    this.idle =
      this.proc && !this.busy
        ? setTimeout(() => {
            if (!this.busy) this.dispose()
          }, this.idleMs)
        : undefined
  }

  private start(): ChildProcessWithoutNullStreams {
    const s = this.settings()
    const proc = spawn(s.python, ['-u', '-m', 'mcb.bridge'], {
      cwd: s.workspace,
      // Parts uses array operations, not BLAS; extra BLAS threads reserve ~1 GB on large CPUs.
      env: { ...pythonEnv(s), ...(this.singleThreaded ? { OPENBLAS_NUM_THREADS: '1' } : {}) },
      windowsHide: true
    })
    const out = lineSplitter()
    const err = lineSplitter()
    proc.stdout.setEncoding('utf8').on('data', (c: string) => {
      if (this.proc === proc) out.feed(c).forEach((l) => this.reply(l))
    })
    proc.stderr
      .setEncoding('utf8')
      .on('data', (c: string) => err.feed(c).forEach((l) => this.note(l)))
    const down = (why: string): void => {
      if (this.proc !== proc) return
      this.proc = null
      const tail = this.log.slice(-8).join('\n')
      for (const p of this.pending.values())
        p.reject(new Error(`bridge ${why}${tail ? `:\n${tail}` : ''}`))
      this.pending.clear()
      this.rest()
    }
    proc.on('error', (e) => down(`failed to start (${s.python}): ${e.message}`))
    proc.on('exit', (code) => down(`exited with code ${code}`))
    return proc
  }

  private reply(line: string): void {
    let msg: {
      id: number
      type: string
      data?: unknown
      error?: { code: string; message: string }
      text?: string
    }
    try {
      msg = JSON.parse(line)
    } catch {
      this.note(`[not protocol] ${line}`)
      return
    }
    if (msg.type === 'log') return this.note(msg.text ?? '')
    const p = this.pending.get(msg.id)
    if (!p) return
    if (msg.type === 'progress') {
      const progress = BridgeProgressSchema.safeParse(msg.data)
      if (progress.success) p.progress?.(progress.data)
      return
    }
    if (msg.type !== 'result' && msg.type !== 'error') return
    this.pending.delete(msg.id)
    this.rest()
    if (msg.type === 'result') p.resolve(msg.data)
    else p.reject(new Error(`${msg.error?.code}: ${msg.error?.message}`))
  }

  call(
    method: string,
    params: Record<string, unknown> = {},
    progress?: (data: BridgeProgress) => void
  ): Promise<unknown> {
    this.proc ??= this.start()
    const id = this.next++
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, progress })
      this.rest()
      progress?.({ stage: 'waiting', fraction: null })
      this.proc!.stdin.write(
        JSON.stringify({ id, method, params, ...(progress ? { progress: true } : {}) }) + '\n'
      )
    })
  }

  /** Stop the worker (settings changed, app quit, idle); the next call starts a fresh one. */
  dispose(): void {
    const proc = this.proc
    this.proc = null
    for (const p of this.pending.values())
      p.reject(new Error('bridge settings changed or app closed'))
    this.pending.clear()
    this.rest()
    if (proc) killTree(proc)
  }
}
