import { describe, expect, it } from 'vitest'
import { processRows } from './rows'

describe('processRows', () => {
  it('groups processes by type and totals CPU and memory', () => {
    const rows = processRows({
      uptime: 1000,
      marks: {},
      mainHeapUsed: 0,
      processes: [
        { type: 'Browser', pid: 1, cpu: 2, workingSetKB: 100 * 1024 },
        { type: 'Tab', pid: 2, cpu: 30, workingSetKB: 300 * 1024 },
        { type: 'Utility', pid: 3, cpu: 1, workingSetKB: 20 * 1024 },
        { type: 'Utility', pid: 4, cpu: 0.5, workingSetKB: 30 * 1024 }
      ]
    })
    expect(rows).toEqual([
      { label: 'Main', value: '2.0% · 100 MB', tone: undefined },
      { label: 'Renderer', value: '30.0% · 300 MB', tone: 'warn' },
      { label: 'Utility ×2', value: '1.5% · 50 MB', tone: undefined },
      { label: 'Total', value: '33.5% · 450 MB' }
    ])
  })
})
