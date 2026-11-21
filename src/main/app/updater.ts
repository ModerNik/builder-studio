import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateState } from '@shared/api'

let state: UpdateState = app.isPackaged
  ? { s: 'idle' }
  : { s: 'off', why: 'Automatic updates are off in development.' }
let emit: (s: UpdateState) => void = () => {}
const set = (s: UpdateState): void => {
  state = s
  emit(s)
}

export const updateState = (): UpdateState => state

function fail(): void {
  if (state.s !== 'error') set({ s: 'error' })
}

export function startUpdater(onState: (s: UpdateState) => void): void {
  emit = onState
  if (!app.isPackaged) return
  autoUpdater.logger = null
  // Failures arrive through the promises in check(); this listener only stops EventEmitter throwing on 'error'.
  autoUpdater.on('error', () => {})
  let version = ''
  autoUpdater.on('checking-for-update', () => set({ s: 'checking' }))
  autoUpdater.on('update-not-available', () => set({ s: 'idle' }))
  autoUpdater.on('update-available', (i) => {
    version = i.version
    set({ s: 'downloading', version, percent: 0 })
  })
  autoUpdater.on('download-progress', (p) =>
    set({ s: 'downloading', version, percent: Math.round(p.percent) })
  )
  autoUpdater.on('update-downloaded', (i) => set({ s: 'ready', version: i.version }))
  checkForUpdate()
}

export function checkForUpdate(): void {
  if (state.s === 'idle' || state.s === 'error') check()
}

function check(): void {
  try {
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'ModerNik',
      repo: 'builder-studio'
      // Never private:true: electron-updater would then prefer GH_TOKEN or GITHUB_TOKEN from the environment.
    })
    void autoUpdater.checkForUpdates().then((result) => result?.downloadPromise?.catch(fail), fail)
  } catch {
    fail()
  }
}

export function installUpdate(): void {
  if (state.s !== 'ready') return
  try {
    autoUpdater.quitAndInstall(true, true)
  } catch {
    set({ s: 'error' })
  }
}
