import { EventEmitter } from 'events'
import { join, resolve } from 'path'
import { beforeEach, expect, it, vi } from 'vitest'
import { MAX_JOB_LOG, SettingsSchema, type Settings } from '@shared/api'
import { resolveLocations, runtimeEnv } from '../app/locations'
import { PythonBridge } from './bridge'
import { JobService } from './jobs'

const mock = vi.hoisted(() => ({ spawn: vi.fn(), settings: null as Settings | null }))
vi.mock('child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('child_process')>()),
  spawn: mock.spawn
}))
vi.mock('../app/settings', () => ({
  resolved: () => mock.settings,
  pythonEnv: () => runtimeEnv(mock.settings!)
}))

function child(): EventEmitter & {
  stdout: EventEmitter
  stderr: EventEmitter
  stdin: { write: ReturnType<typeof vi.fn> }
  exitCode: null
} {
  const stream = (): EventEmitter =>
    Object.assign(new EventEmitter(), { setEncoding: vi.fn().mockReturnThis() })
  return Object.assign(new EventEmitter(), {
    stdout: stream(),
    stderr: stream(),
    stdin: { write: vi.fn() },
    exitCode: null
  })
}

beforeEach(() => {
  mock.spawn.mockReset()
  mock.settings = resolveLocations(
    SettingsSchema.parse({
      workspace: resolve('workspace сборка'),
      python: '',
      pack: '',
      jar: '',
      schematics: '',
      claude: ''
    }),
    {
      resources: resolve('installed ресурсы'),
      runtime: resolve('runtime среда'),
      cache: resolve('cache кэш'),
      claude: 'claude.exe'
    }
  )
})

it('runs jobs in the workspace with the shared environment and stages shipping in the cache', () => {
  const proc = child()
  mock.spawn.mockReturnValue(proc)
  const jobs = new JobService(vi.fn())
  jobs.run({ build: 'starter', part: 'full', ship: true })
  const [python, args, options] = mock.spawn.mock.calls[0]
  expect(python).toBe(mock.settings!.python)
  expect(args).toEqual(['builds/starter/build.py', 'full'])
  expect(options.cwd).toBe(mock.settings!.workspace)
  expect(options.env.MCB_WORKSPACE).toBe(mock.settings!.workspace)
  expect(options.env.MCB_RESOURCES).toBe(mock.settings!.resources)
  expect(options.env.MCB_SCHEMATICS).toBe(jobs.list()[0].staging)
  expect(jobs.list()[0].staging).toContain(join(mock.settings!.cache, 'ship'))
  proc.stdout.emit('data', '@mcb {"v":1,"event":"sheet","path":"builds/starter/out/sheet.png"}\n')
  proc.emit('close', 0)
  expect(jobs.list()[0].state).toBe('done')
  expect(jobs.list()[0].events[0]).toEqual({
    v: 1,
    event: 'sheet',
    path: 'builds/starter/out/sheet.png'
  })
  jobs.clear()
  expect(jobs.list()).toEqual([])
})

it('batches job log lines, in order with events, and keeps the last MAX_JOB_LOG lines', () => {
  vi.useFakeTimers()
  const proc = child()
  mock.spawn.mockReturnValue(proc)
  const send = vi.fn()
  const jobs = new JobService(send)
  jobs.run({ build: 'starter', part: 'proto' })
  proc.stdout.emit('data', 'a\nb\n@mcb {"v":1,"event":"stage","name":"lint"}\nc\n')
  proc.stderr.emit('data', 'd\n')
  const sent = (): unknown[] => send.mock.calls.slice(1).map(([u]) => u.lines ?? u.kind)
  expect(sent()).toEqual([['a', 'b'], 'event'])
  vi.advanceTimersByTime(100)
  expect(sent()).toEqual([['a', 'b'], 'event', ['c', 'd']])
  proc.stdout.emit('data', Array.from({ length: MAX_JOB_LOG + 10 }, (_, i) => `${i}\n`).join(''))
  proc.emit('close', 0)
  expect(sent().slice(-2)).toEqual([expect.any(Array), 'end'])
  expect(jobs.list()[0].log).toHaveLength(MAX_JOB_LOG)
  expect(jobs.list()[0].log.at(-1)).toBe(String(MAX_JOB_LOG + 9))
  vi.useRealTimers()
})

it('restarts the bridge after location changes without accepting replies from the old worker', async () => {
  const first = child(),
    second = child()
  mock.spawn.mockReturnValueOnce(first).mockReturnValueOnce(second)
  const bridge = new PythonBridge()
  const pending = bridge.call('ping')
  const rejected = expect(pending).rejects.toThrow('settings changed')
  bridge.dispose()
  await rejected
  mock.settings = { ...mock.settings!, workspace: resolve('other workspace проекты') }
  const next = bridge.call('ping')
  const [python, args, options] = mock.spawn.mock.calls[1]
  expect(python).toBe(mock.settings.python)
  expect(args).toEqual(['-u', '-m', 'mcb.bridge'])
  expect(options.cwd).toBe(mock.settings.workspace)
  expect(options.env.MCB_CACHE).toBe(mock.settings.cache)
  first.emit('exit', 1)
  second.stdout.emit('data', '{"id":2,"type":"result","data":{"protocol":1}}\n')
  await expect(next).resolves.toEqual({ protocol: 1 })
  expect(second.stdin.write).toHaveBeenCalledWith('{"id":2,"method":"ping","params":{}}\n')
  bridge.dispose()
})
