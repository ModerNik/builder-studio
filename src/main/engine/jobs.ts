// JobService: one Python subprocess per build job (builds clash in one interpreter), events parsed from stdout.
import { spawn, type ChildProcess } from 'child_process'
import { MAX_JOB_LOG, type Job, type JobSpec, type JobUpdate, type Settings } from '@shared/api'
import { lineSplitter, parseEvent } from '@shared/events'
import { pythonEnv, resolved } from '../app/settings'
import { stagingDir } from '../workspace/ship'

const LOG_BATCH_MS = 100 // one IPC message per batch: a chatty build sent thousands per second
const MAX_JOBS = 30
// build.py has no dump part: call mcb.dump the way the bridge does, in its own process
const DUMP =
  "import sys; from mcb.bridge import dump; print(dump(sys.argv[1], sys.argv[2], int(sys.argv[3]))['text'])"

export function jobArgs(spec: JobSpec): string[] {
  if (spec.part === 'dump') return ['-c', DUMP, spec.path, spec.axis, String(spec.index)]
  const args = [`builds/${spec.build}/build.py`, spec.part]
  if (spec.noRender) args.push('--no-render')
  const flags = {
    name: spec.name,
    x0: spec.x0,
    z0: spec.z0,
    sx: spec.sx,
    sz: spec.sz,
    seed: spec.seed,
    views: spec.views,
    look: spec.look
  }
  for (const [k, v] of Object.entries(flags))
    if (v !== undefined && v !== '') args.push(`--${k}`, String(v))
  return args
}

export function killTree(child: ChildProcess): void {
  if (child.pid === undefined || child.exitCode !== null) return
  if (process.platform === 'win32')
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true })
  else child.kill('SIGKILL')
}

export class JobService {
  private jobs: Job[] = []
  private procs = new Map<number, ChildProcess>()
  private next = 1

  constructor(private send: (u: JobUpdate) => void) {}

  list(): Job[] {
    return this.jobs
  }

  run(spec: JobSpec, s: Settings = resolved()): number {
    const job: Job = {
      minecraftVersion: s.minecraftVersion,
      id: this.next++,
      spec,
      state: 'running',
      started: Date.now(),
      events: [],
      log: []
    }
    this.jobs = [job, ...this.jobs].slice(0, MAX_JOBS)
    this.send({ id: job.id, kind: 'start', job })

    let lines: string[] = []
    let timer: NodeJS.Timeout | undefined
    const flush = (): void => {
      clearTimeout(timer)
      timer = undefined
      if (!lines.length) return
      if (job.log.length > MAX_JOB_LOG) job.log.splice(0, job.log.length - MAX_JOB_LOG)
      this.send({ id: job.id, kind: 'log', lines })
      lines = []
    }
    const log = (line: string): void => {
      job.log.push(line)
      lines.push(line)
      timer ??= setTimeout(flush, LOG_BATCH_MS)
    }
    const env = pythonEnv(s)
    if (spec.part === 'full' && spec.ship)
      env.MCB_SCHEMATICS = job.staging = stagingDir(s.cache, spec.build)
    const child = spawn(s.python, jobArgs(spec), { cwd: s.workspace, env, windowsHide: true })
    this.procs.set(job.id, child)
    const out = lineSplitter()
    const err = lineSplitter()
    const onOut = (line: string): void => {
      const event = parseEvent(line)
      if (!event) return log(line)
      job.events.push(event)
      if (event.event === 'stage') job.stage = event.name
      flush()
      this.send({ id: job.id, kind: 'event', event })
    }
    child.stdout.setEncoding('utf8').on('data', (c: string) => out.feed(c).forEach(onOut))
    child.stderr.setEncoding('utf8').on('data', (c: string) => err.feed(c).forEach(log))
    child.on('error', (e) => log(`spawn failed: ${e.message} (${s.python})`))
    child.on('close', (code) => {
      out.flush().forEach(onOut)
      err.flush().forEach(log)
      flush()
      this.procs.delete(job.id)
      if (job.state === 'running') job.state = code === 0 ? 'done' : 'failed'
      job.code = code
      job.ended = Date.now()
      this.send({ id: job.id, kind: 'end', state: job.state, code })
    })
    return job.id
  }

  cancel(id: number): void {
    const child = this.procs.get(id)
    const job = this.jobs.find((j) => j.id === id)
    if (!child || !job) return
    job.state = 'cancelled'
    killTree(child)
  }

  clear(): void {
    this.jobs = []
  }

  dispose(): void {
    for (const id of this.procs.keys()) this.cancel(id)
  }
}
