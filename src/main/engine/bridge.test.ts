import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { PythonBridge } from './bridge'

const mocks = vi.hoisted(() => ({ spawn: vi.fn(), kill: vi.fn() }))
vi.mock('child_process', () => ({ spawn: mocks.spawn }))
vi.mock('./jobs', () => ({ killTree: mocks.kill }))
vi.mock('../app/settings', () => ({
  resolved: () => ({ python: 'python', workspace: '/workspace' }),
  pythonEnv: () => ({})
}))

function processDouble(): EventEmitter & {
  stdout: EventEmitter
  stderr: EventEmitter
  stdin: { write: ReturnType<typeof vi.fn> }
} {
  const stream = (): EventEmitter => {
    const emitter = new EventEmitter()
    Object.assign(emitter, { setEncoding: () => emitter })
    return emitter
  }
  return Object.assign(new EventEmitter(), {
    stdout: stream(),
    stderr: stream(),
    stdin: { write: vi.fn() }
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})
afterEach(() => {
  vi.useRealTimers()
})

it('routes progress without settling, ignores malformed progress and resolves only the result', async () => {
  const proc = processDouble()
  mocks.spawn.mockReturnValue(proc)
  const bridge = new PythonBridge()
  const progress = vi.fn()
  let settled = false
  const result = bridge.call('part_colors', { path: 'a' }, progress).then((r) => {
    settled = true
    return r
  })
  proc.stdout.emit(
    'data',
    '{"id":1,"type":"progress","data":{"stage":"encoding","fraction":0.4}}\n'
  )
  proc.stdout.emit('data', '{"id":1,"type":"progress","data":{"stage":"encoding","fraction":2}}\n')
  proc.stdout.emit(
    'data',
    '{"id":1,"type":"progress","data":{"stage":"encoding","fraction":0.8}}\n'
  )
  await Promise.resolve()
  expect(settled).toBe(false)
  expect(progress.mock.calls.map(([p]) => p.fraction)).toEqual([null, 0.4, 0.8])
  expect(JSON.parse(proc.stdin.write.mock.calls[0][0]).progress).toBe(true)
  proc.stdout.emit('data', '{"id":1,"type":"result","data":{"path":"ready"}}\n')
  await expect(result).resolves.toEqual({ path: 'ready' })
  bridge.dispose()
})

it('parts can finish while an independent analysis worker is busy; disposal rejects pending work', async () => {
  const slow = processDouble(),
    fast = processDouble()
  mocks.spawn.mockReturnValueOnce(slow).mockReturnValueOnce(fast)
  const analysis = new PythonBridge(),
    parts = new PythonBridge(true)
  const lint = analysis.call('lint')
  const rejected = expect(lint).rejects.toThrow('settings changed')
  const result = parts.call('parts')
  expect(mocks.spawn.mock.calls[0][2].env.OPENBLAS_NUM_THREADS).toBeUndefined()
  expect(mocks.spawn.mock.calls[1][2].env.OPENBLAS_NUM_THREADS).toBe('1')
  fast.stdout.emit('data', '{"id":1,"type":"result","data":{"parts":[]}}\n')
  await expect(result).resolves.toEqual({ parts: [] })
  analysis.dispose()
  parts.dispose()
  await rejected
  expect(mocks.kill).toHaveBeenCalledTimes(2)
})

it('rejects on a crash and ignores output from the previous process after restart', async () => {
  const old = processDouble(),
    fresh = processDouble()
  mocks.spawn.mockReturnValueOnce(old).mockReturnValueOnce(fresh)
  const bridge = new PythonBridge()
  const first = bridge.call('parts')
  const rejected = expect(first).rejects.toThrow('exited')
  old.emit('exit', 1)
  await rejected
  const next = bridge.call('parts')
  old.stdout.emit('data', '{"id":2,"type":"error","error":{"code":"old","message":"stale"}}\n')
  fresh.stdout.emit('data', '{"id":2,"type":"result","data":42}\n')
  await expect(next).resolves.toBe(42)
  bridge.dispose()
})

it('stops an idle worker and respawns on the next call; a call in flight is never stopped', async () => {
  vi.useFakeTimers()
  const first = processDouble(),
    second = processDouble()
  mocks.spawn.mockReturnValueOnce(first).mockReturnValueOnce(second)
  const bridge = new PythonBridge(false, undefined, 1000)
  const slow = bridge.call('render')
  vi.advanceTimersByTime(60_000)
  expect(mocks.kill).not.toHaveBeenCalled()
  first.stdout.emit('data', '{"id":1,"type":"result","data":1}\n')
  await expect(slow).resolves.toBe(1)
  vi.advanceTimersByTime(999)
  // a call arriving before the timeout starts the countdown again once it settles
  const quick = bridge.call('lint')
  vi.advanceTimersByTime(5000)
  first.stdout.emit('data', '{"id":2,"type":"result","data":2}\n')
  await expect(quick).resolves.toBe(2)
  vi.advanceTimersByTime(999)
  expect(mocks.kill).not.toHaveBeenCalled()
  vi.advanceTimersByTime(1)
  expect(mocks.kill).toHaveBeenCalledExactlyOnceWith(first)
  const next = bridge.call('lint')
  expect(mocks.spawn).toHaveBeenCalledTimes(2)
  second.stdout.emit('data', '{"id":3,"type":"result","data":3}\n')
  await expect(next).resolves.toBe(3)
  bridge.dispose()
  vi.advanceTimersByTime(5000)
  expect(mocks.kill).toHaveBeenCalledTimes(2)
})

it('caps the log on every path: stderr, protocol log messages and stray stdout', async () => {
  const proc = processDouble()
  mocks.spawn.mockReturnValue(proc)
  const bridge = new PythonBridge()
  void bridge.call('lint').catch(() => {})
  for (let i = 0; i < 400; i++) {
    proc.stderr.emit('data', `warn ${i}\n`)
    proc.stdout.emit('data', `{"id":0,"type":"log","text":"print ${i}"}\n`)
    proc.stdout.emit('data', `stray ${i}\n`)
  }
  expect(bridge.log).toHaveLength(500)
  expect(bridge.log.at(-1)).toBe('[not protocol] stray 399')
  bridge.dispose()
})
