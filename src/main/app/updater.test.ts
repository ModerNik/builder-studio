import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  app: { isPackaged: true },
  updater: {
    logger: console as unknown,
    allowPrerelease: false,
    disableDifferentialDownload: false,
    setFeedURL: vi.fn(),
    checkForUpdates: vi.fn<() => Promise<unknown>>(),
    quitAndInstall: vi.fn()
  }
}))
const events = new EventEmitter()
vi.mock('electron', () => ({ app: mocks.app }))
vi.mock('electron-updater', () => ({
  autoUpdater: Object.assign(mocks.updater, { on: events.on.bind(events) })
}))
const feed = { provider: 'github', owner: 'ModerNik', repo: 'builder-studio' }
const httpError = (statusCode: number): Error => Object.assign(new Error('HTTP'), { statusCode })
beforeEach(() => {
  vi.resetModules()
  vi.resetAllMocks()
  events.removeAllListeners()
  mocks.app.isPackaged = true
  mocks.updater.allowPrerelease = false
  mocks.updater.disableDifferentialDownload = false
  mocks.updater.checkForUpdates.mockResolvedValue(null)
  vi.stubEnv('GH_TOKEN', 'unrelated-cli-token')
})
afterEach(() => vi.unstubAllEnvs())

it('checks the public feed without a token and installs the download', async () => {
  const { startUpdater, updateState, installUpdate } = await import('./updater')
  startUpdater(vi.fn())
  expect(mocks.updater.logger).toBeNull()
  expect(mocks.updater.allowPrerelease).toBe(false)
  expect(mocks.updater.disableDifferentialDownload).toBe(false)
  expect(mocks.updater.setFeedURL).toHaveBeenCalledWith(feed)
  expect(mocks.updater.checkForUpdates).toHaveBeenCalledOnce()

  events.emit('update-available', { version: '1.0.4' })
  events.emit('download-progress', { percent: 34.7 })
  expect(updateState()).toEqual({ s: 'downloading', version: '1.0.4', percent: 35 })
  events.emit('update-downloaded', { version: '1.0.4' })
  installUpdate()
  expect(mocks.updater.quitAndInstall).toHaveBeenCalledWith(true, true)
})

it('reports check, download and install failures without forwarding raw errors and allows retry', async () => {
  const { startUpdater, updateState, checkForUpdate, installUpdate } = await import('./updater')
  const send = vi.fn()
  const failure = new Error('raw transport failure')
  mocks.updater.checkForUpdates.mockRejectedValueOnce(httpError(404))
  startUpdater(send)
  await vi.waitFor(() => expect(updateState()).toEqual({ s: 'error' }))
  send.mockClear()

  mocks.updater.checkForUpdates.mockRejectedValueOnce(httpError(500))
  checkForUpdate()
  await vi.waitFor(() => expect(mocks.updater.checkForUpdates).toHaveBeenCalledTimes(2))
  expect(updateState()).toEqual({ s: 'error' })
  send.mockClear()

  mocks.updater.checkForUpdates.mockImplementationOnce(async () => {
    events.emit('checking-for-update')
    return { downloadPromise: Promise.reject(failure) }
  })
  checkForUpdate()
  await vi.waitFor(() => expect(updateState()).toEqual({ s: 'error' }))
  expect(send.mock.calls).toEqual([[{ s: 'checking' }], [{ s: 'error' }]])

  events.emit('update-downloaded', { version: '1.0.4' })
  mocks.updater.quitAndInstall.mockImplementationOnce(() => {
    throw failure
  })
  installUpdate()
  expect(send).toHaveBeenLastCalledWith({ s: 'error' })
})

it('leaves updates disabled in development', async () => {
  mocks.app.isPackaged = false
  const { startUpdater, updateState, checkForUpdate } = await import('./updater')
  startUpdater(vi.fn())
  checkForUpdate()
  expect(updateState().s).toBe('off')
  expect(mocks.updater.setFeedURL).not.toHaveBeenCalled()
})
