import { describe, expect, it, vi } from 'vitest'
import {
  encodeHiresChunk,
  encodeLowresTile,
  LOWRES_CELLS,
  LOWRES_GRID,
  LOWRES_STEP,
  NO_HEIGHT
} from '@shared/world-tiles'
import type { StreamStats, WorldDataSource } from '../model/types'
import { meshHires, meshLowres, type WorkerErrorResult } from './world-mesher.worker'
import { WorldStreamer, type WorkerLike } from './WorldStreamer'

function makeFakeWorker(mode: 'ok' | 'error-reply' | 'worker-crash' = 'ok'): WorkerLike {
  const worker: WorkerLike = {
    onmessage: null,
    onerror: null,
    onmessageerror: null,
    postMessage(msg: unknown) {
      const m = msg as { type: string; id?: number; buffer?: ArrayBuffer }
      if (m.type === 'init') return
      queueMicrotask(() => {
        if (mode === 'worker-crash') {
          worker.onerror?.({ message: 'worker crashed' } as ErrorEvent)
          return
        }
        if (mode === 'error-reply') {
          const err: WorkerErrorResult = {
            type: 'error',
            id: m.id!,
            message: 'corrupt tile'
          }
          worker.onmessage?.({ data: err } as MessageEvent)
          return
        }
        if (m.type === 'lowres' && m.buffer) {
          const res = meshLowres(m.id!, m.buffer)
          worker.onmessage?.({ data: res } as MessageEvent)
        }
      })
    },
    terminate() {
      // noop
    }
  }
  return worker
}

function makeLowresBuffer(): ArrayBuffer {
  const surfaceY = new Int16Array(LOWRES_CELLS).fill(NO_HEIGHT)
  const oceanFloorY = new Int16Array(LOWRES_CELLS).fill(NO_HEIGHT)
  const topBlock = new Uint16Array(LOWRES_CELLS)
  const flags = new Uint8Array(LOWRES_CELLS)
  surfaceY[0] = 64
  oceanFloorY[0] = 64
  topBlock[0] = 1
  const encoded = encodeLowresTile({
    rx: 0,
    rz: 0,
    step: LOWRES_STEP,
    grid: LOWRES_GRID,
    palette: ['minecraft:air', 'minecraft:stone'],
    surfaceY,
    oceanFloorY,
    topBlock,
    flags
  })
  return new Uint8Array(encoded).buffer
}

async function flush(): Promise<void> {
  for (let i = 0; i < 6; i++) await Promise.resolve()
}

describe('WorldStreamer resilience and stats deduplication', () => {
  it('records fetch failures without retrying in a loop and surfaces the error', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const statsHistory: StreamStats[] = []
    const fetchLowres = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    const source: WorldDataSource = {
      key: 'worldA::overworld',
      dimension: 'overworld',
      regions: [[0, 0]],
      fetchLowres,
      fetchHires: vi.fn().mockResolvedValue(null)
    }

    const streamer = new WorldStreamer(
      () => {},
      (s) => statsHistory.push(s),
      {
        createWorker: () => makeFakeWorker('ok'),
        workerCount: 1,
        loadColors: async () => ({})
      }
    )

    streamer.setSource(source)
    streamer.update(64, 64, 500, '3d')
    await flush()

    // Subsequent update ticks must not re-fetch the failed region
    streamer.update(64, 64, 500, '3d')
    streamer.update(64, 64, 500, '3d')
    await flush()

    expect(fetchLowres).toHaveBeenCalledTimes(1)
    expect(statsHistory.at(-1)).toEqual({
      lowresLoaded: 0,
      hiresLoaded: 0,
      pending: 0,
      error: 'Failed to fetch'
    })

    streamer.dispose()
    errSpy.mockRestore()
  })

  it('settles pending jobs on worker error replies and worker crashes', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    for (const mode of ['error-reply', 'worker-crash'] as const) {
      const statsHistory: StreamStats[] = []
      const streamer = new WorldStreamer(
        () => {},
        (s) => statsHistory.push(s),
        {
          createWorker: () => makeFakeWorker(mode),
          workerCount: 1,
          loadColors: async () => ({})
        }
      )
      streamer.setSource({
        key: `world-${mode}::overworld`,
        dimension: 'overworld',
        regions: [[0, 0]],
        fetchLowres: async () => makeLowresBuffer(),
        fetchHires: async () => null
      })
      streamer.update(64, 64, 500, '3d')
      await flush()

      const last = statsHistory.at(-1)
      expect(last?.pending).toBe(0)
      expect(last?.error).toBeTruthy()
      streamer.dispose()
    }
    errSpy.mockRestore()
  })

  it('deduplicates identical idle stats emissions across update ticks', async () => {
    const statsHistory: StreamStats[] = []
    const streamer = new WorldStreamer(
      () => {},
      (s) => statsHistory.push(s),
      {
        createWorker: () => makeFakeWorker('ok'),
        workerCount: 1,
        loadColors: async () => ({})
      }
    )
    streamer.setSource({
      key: 'worldB::overworld',
      dimension: 'overworld',
      regions: [[0, 0]],
      fetchLowres: async () => makeLowresBuffer(),
      fetchHires: async () => null
    })
    streamer.update(64, 64, 500, '3d')
    await flush()

    const countAfterLoad = statsHistory.length
    expect(statsHistory.at(-1)).toEqual({
      lowresLoaded: 1,
      hiresLoaded: 0,
      pending: 0,
      error: null
    })

    // Repeated idle updates should not emit redundant stats objects
    for (let i = 0; i < 10; i++) streamer.update(64, 64, 500, '3d')
    expect(statsHistory.length).toBe(countAfterLoad)

    streamer.dispose()
  })

  it('discards stale hires worker replies after setResources replaces materials', async () => {
    const deferred: Array<() => void> = []
    const worker: WorkerLike = {
      onmessage: null,
      onerror: null,
      onmessageerror: null,
      postMessage(msg: unknown) {
        const m = msg as { type: string; id?: number; buffer?: ArrayBuffer }
        if (m.type === 'hires' && m.buffer) {
          const id = m.id!
          const buf = m.buffer
          deferred.push(() => {
            worker.onmessage?.({ data: meshHires(id, buf) } as MessageEvent)
          })
        }
      },
      terminate() {
        // noop
      }
    }

    const blocks = new Uint16Array(16 * 2 * 16)
    blocks[0] = 1
    const surfaceY = new Int16Array(256).fill(NO_HEIGHT)
    surfaceY[0] = 64
    const makeHiBuf = (): ArrayBuffer =>
      new Uint8Array(
        encodeHiresChunk({
          cx: 0,
          cz: 0,
          minY: 64,
          height: 2,
          palette: ['minecraft:air', 'minecraft:stone'],
          surfaceY,
          blocks
        })
      ).buffer

    const statsHistory: StreamStats[] = []
    const streamer = new WorldStreamer(
      () => {},
      (s) => statsHistory.push(s),
      {
        createWorker: () => worker,
        workerCount: 1,
        loadColors: async () => ({})
      }
    )

    streamer.setSource({
      key: 'worldC::overworld',
      dimension: 'overworld',
      regions: [[0, 0]],
      fetchLowres: async () => null,
      fetchHires: async (cx, cz) => (cx === 0 && cz === 0 ? makeHiBuf() : null)
    })

    // Start streaming a hires chunk while resources are null
    streamer.update(8, 8, 80, '3d')
    await flush()
    expect(deferred.length).toBe(1)

    // Resources swap mid-flight; stale pre-resource worker reply must NOT mount
    streamer.setResources(null)
    deferred[0]()
    await flush()

    expect(statsHistory.at(-1)?.hiresLoaded).toBe(0)
    expect(streamer.hiresGroup.children.length).toBe(0)

    streamer.dispose()
  })
})
