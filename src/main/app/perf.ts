// Dev performance numbers for the perf HUD and CDP benchmark scripts. Off in normal packaged runs.
import { app } from 'electron'
import { is } from '@electron-toolkit/utils'
import type { PerfSample } from '@shared/api'

/** On in development, or in any build started with BS_PERF=1 (to benchmark the production bundle). */
export const perfEnabled = is.dev || process.env['BS_PERF'] === '1'

const marks: Record<string, number> = {}

/** Records a boot milestone once, in ms since the main process started. */
export function perfMark(name: string): void {
  if (perfEnabled && !(name in marks)) marks[name] = Math.round(performance.now())
}

export function perfSample(): PerfSample {
  return {
    uptime: Math.round(performance.now()),
    marks,
    processes: app.getAppMetrics().map((m) => ({
      type: m.type,
      name: m.name ?? m.serviceName,
      pid: m.pid,
      cpu: Math.round(m.cpu.percentCPUUsage * 10) / 10,
      workingSetKB: m.memory.workingSetSize,
      privateKB: m.memory.privateBytes
    })),
    mainHeapUsed: process.memoryUsage().heapUsed
  }
}
