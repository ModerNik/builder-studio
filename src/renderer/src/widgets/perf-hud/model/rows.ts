// Pure formatting for the perf HUD rows (kept apart from perf.ts so tests load without window.studio).
import type { PerfSample } from '@shared/api'

export interface PerfRow {
  label: string
  value: string
  tone?: 'warn' | 'bad'
}
export interface PerfGroup {
  title: string
  rows: PerfRow[]
}

export const mb = (bytes: number): string => `${(bytes / 1048576).toFixed(0)} MB`
export const ms = (n: number): string => `${n.toFixed(n < 10 ? 1 : 0)} ms`
export const tone = (v: number, warn: number, bad: number): PerfRow['tone'] =>
  v >= bad ? 'bad' : v >= warn ? 'warn' : undefined

const PROCESS_LABEL: Record<string, string> = {
  Browser: 'Main',
  Tab: 'Renderer',
  GPU: 'GPU',
  Utility: 'Utility'
}

/** Per-process CPU and RAM, grouped by type, plus the total. Pure, so it is tested. */
export function processRows(sample: PerfSample): PerfRow[] {
  const by = new Map<string, { cpu: number; kb: number; n: number }>()
  for (const p of sample.processes) {
    const key = PROCESS_LABEL[p.type] ?? p.type
    const a = by.get(key) ?? { cpu: 0, kb: 0, n: 0 }
    by.set(key, { cpu: a.cpu + p.cpu, kb: a.kb + p.workingSetKB, n: a.n + 1 })
  }
  const rows = [...by].map(([label, a]) => ({
    label: a.n > 1 ? `${label} ×${a.n}` : label,
    value: `${a.cpu.toFixed(1)}% · ${mb(a.kb * 1024)}`,
    tone: tone(a.cpu, 25, 60)
  }))
  const cpu = sample.processes.reduce((s, p) => s + p.cpu, 0)
  const kb = sample.processes.reduce((s, p) => s + p.workingSetKB, 0)
  return [...rows, { label: 'Total', value: `${cpu.toFixed(1)}% · ${mb(kb * 1024)}` }]
}
