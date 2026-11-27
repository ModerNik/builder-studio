import { describe, expect, it, vi } from 'vitest'
import type { WorldWorkerRequest, WorldWorkerResponse } from './world-worker'
import { regionShard, WorldWorkerPool, type WorkerThreadLike } from './world-worker-pool'

interface FakeThread extends WorkerThreadLike {
  requests: WorldWorkerRequest[]
  terminated: boolean
  emitMessage(msg: WorldWorkerResponse): void
  emitError(err: Error): void
  emitExit(code: number): void
}

function createFakeThread(): FakeThread {
  const listeners: {
    message: Array<(msg: WorldWorkerResponse) => void>
    error: Array<(err: Error) => void>
    exit: Array<(code: number) => void>
  } = { message: [], error: [], exit: [] }

  const fake: FakeThread = {
    requests: [],
    terminated: false,
    on(event: 'message' | 'error' | 'exit', listener: never) {
      ;(listeners[event] as unknown[]).push(listener)
      return fake
    },
    postMessage(req: WorldWorkerRequest) {
      fake.requests.push(req)
    },
    terminate() {
      fake.terminated = true
    },
    emitMessage(msg) {
      for (const fn of listeners.message) fn(msg)
    },
    emitError(err) {
      for (const fn of listeners.error) fn(err)
    },
    emitExit(code) {
      for (const fn of listeners.exit) fn(code)
    }
  }
  return fake
}

describe('WorldWorkerPool', () => {
  it('routes lowres regions and hires chunks in the same region to the exact same worker shard', () => {
    const rShard = regionShard('/saves/world', 'overworld', -2, 3, 4)
    expect(regionShard('/saves/world', 'overworld', (-64) >> 5, 96 >> 5, 4)).toBe(rShard)
    expect(regionShard('/saves/world', 'overworld', (-33) >> 5, 127 >> 5, 4)).toBe(rShard)
  })

  it('dispatches tasks off-thread, cancels queued tasks on AbortSignal, and respawns after worker crash', async () => {
    const threads: FakeThread[] = []
    const createWorker = vi.fn(() => {
      const t = createFakeThread()
      threads.push(t)
      return t
    })
    const pool = new WorldWorkerPool({ createWorker, poolSize: 1, maxPerWorker: 1 })

    const p1 = pool.readLowres('/saves/w', 'overworld', 0, 0, '/cache')
    const ac = new AbortController()
    const p2 = pool.readHires('/saves/w', 'overworld', 1, 2, '/cache', ac.signal)
    const p3 = pool.readHires('/saves/w', 'overworld', 3, 4, '/cache')

    // Only p1 is dispatched because maxPerWorker = 1; p2 and p3 are queued
    expect(threads).toHaveLength(1)
    expect(threads[0].requests).toHaveLength(1)

    // Abort p2 while queued — it must never be dispatched to the worker
    ac.abort()
    await expect(p2).rejects.toThrow(/aborted/i)

    // Complete p1 -> p3 should dispatch immediately, skipping aborted p2
    const payload = new Uint8Array([1, 2, 3, 4]).buffer
    threads[0].emitMessage({ id: threads[0].requests[0].id, ok: true, buffer: payload })
    const res1 = await p1
    expect(Array.from(res1!)).toEqual([1, 2, 3, 4])

    expect(threads[0].requests).toHaveLength(2)
    expect(threads[0].requests[1].x).toBe(3)

    // Crash worker during p3, then ensure a follow-up request respawns a fresh worker
    threads[0].emitError(new Error('worker boom'))
    await expect(p3).rejects.toThrow('worker boom')

    const p4 = pool.readLowres('/saves/w', 'overworld', 1, 0, '/cache')
    expect(threads).toHaveLength(2)
    threads[1].emitMessage({ id: threads[1].requests[0].id, ok: true, buffer: null })
    expect(await p4).toBeNull()

    pool.dispose()
    expect(threads[1].terminated).toBe(true)
  })
})
