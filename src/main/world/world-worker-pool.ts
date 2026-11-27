// Region-affinity Node worker_threads pool for world:// tile extraction.
// Routes all requests for the same (world, dim, rx, rz) region to one worker so each .mca file
// stays cached in RAM once per shard, and drops AbortSignal-cancelled requests before dispatch.
import { cpus } from 'node:os'
import type { WorldDimension } from '@shared/api'
import type { WorldWorkerRequest, WorldWorkerResponse } from './world-worker'

export interface WorkerThreadLike {
  on(event: 'message', listener: (msg: WorldWorkerResponse) => void): unknown
  on(event: 'error', listener: (err: Error) => void): unknown
  on(event: 'exit', listener: (code: number) => void): unknown
  postMessage(value: WorldWorkerRequest): void
  terminate(): Promise<number> | void
}

export interface WorldWorkerPoolOptions {
  createWorker: () => WorkerThreadLike
  poolSize?: number
  maxPerWorker?: number
}

interface PendingTask {
  req: WorldWorkerRequest
  resolve: (bytes: Uint8Array | null) => void
  reject: (err: Error) => void
  signal?: AbortSignal
  onAbort?: () => void
  dispatched: boolean
}

interface ShardSlot {
  worker: WorkerThreadLike | null
  inflight: Map<number, PendingTask>
  queue: PendingTask[]
}

function abortError(): Error {
  const err = new Error('World tile request aborted')
  err.name = 'AbortError'
  return err
}

/** Deterministic FNV-1a region shard so a region's lowres + hires requests share one worker's LRU. */
export function regionShard(
  worldPath: string,
  dim: WorldDimension,
  rx: number,
  rz: number,
  poolSize: number
): number {
  let h = 2166136261
  for (let i = 0; i < worldPath.length; i++) {
    h = Math.imul(h ^ worldPath.charCodeAt(i), 16777619)
  }
  for (let i = 0; i < dim.length; i++) {
    h = Math.imul(h ^ dim.charCodeAt(i), 16777619)
  }
  h = Math.imul(h ^ (rx | 0), 16777619)
  h = Math.imul(h ^ (rz | 0), 16777619)
  return (h >>> 0) % poolSize
}

export class WorldWorkerPool {
  readonly poolSize: number
  private readonly maxPerWorker: number
  private readonly createWorker: () => WorkerThreadLike
  private readonly slots: ShardSlot[]
  private nextId = 1
  private disposed = false

  constructor(options: WorldWorkerPoolOptions) {
    this.createWorker = options.createWorker
    const defaultSize = Math.max(2, Math.min(4, Math.floor((cpus().length || 4) / 2)))
    this.poolSize = Math.max(1, options.poolSize ?? defaultSize)
    this.maxPerWorker = Math.max(1, options.maxPerWorker ?? 2)
    this.slots = Array.from({ length: this.poolSize }, () => ({
      worker: null,
      inflight: new Map(),
      queue: []
    }))
  }

  readLowres(
    worldPath: string,
    dim: WorldDimension,
    rx: number,
    rz: number,
    cacheRoot: string,
    signal?: AbortSignal
  ): Promise<Uint8Array | null> {
    const shard = regionShard(worldPath, dim, rx, rz, this.poolSize)
    return this.enqueue(shard, { kind: 'lowres', worldPath, dim, x: rx, z: rz, cacheRoot }, signal)
  }

  readHires(
    worldPath: string,
    dim: WorldDimension,
    cx: number,
    cz: number,
    cacheRoot: string,
    signal?: AbortSignal
  ): Promise<Uint8Array | null> {
    const shard = regionShard(worldPath, dim, cx >> 5, cz >> 5, this.poolSize)
    return this.enqueue(shard, { kind: 'hires', worldPath, dim, x: cx, z: cz, cacheRoot }, signal)
  }

  private enqueue(
    shard: number,
    payload: Omit<WorldWorkerRequest, 'id'>,
    signal?: AbortSignal
  ): Promise<Uint8Array | null> {
    if (this.disposed) return Promise.reject(abortError())
    if (signal?.aborted) return Promise.reject(abortError())

    const id = this.nextId++
    const slot = this.slots[shard]
    return new Promise<Uint8Array | null>((resolve, reject) => {
      const task: PendingTask = {
        req: { ...payload, id },
        resolve,
        reject,
        signal,
        dispatched: false
      }
      if (signal) {
        const onAbort = (): void => {
          this.cleanupAbort(task)
          if (!task.dispatched) {
            const idx = slot.queue.indexOf(task)
            if (idx >= 0) slot.queue.splice(idx, 1)
            task.reject(abortError())
          } else {
            // Reject caller immediately; ignore late worker reply for this id
            slot.inflight.delete(id)
            task.reject(abortError())
            this.pump(shard)
          }
        }
        task.onAbort = onAbort
        signal.addEventListener('abort', onAbort, { once: true })
      }
      slot.queue.push(task)
      this.pump(shard)
    })
  }

  private cleanupAbort(task: PendingTask): void {
    if (task.signal && task.onAbort) {
      task.signal.removeEventListener('abort', task.onAbort)
      task.onAbort = undefined
    }
  }

  private ensureWorker(shard: number): WorkerThreadLike {
    const slot = this.slots[shard]
    if (slot.worker) return slot.worker
    const w = this.createWorker()
    slot.worker = w

    w.on('message', (msg: WorldWorkerResponse) => {
      const task = slot.inflight.get(msg.id)
      if (!task) {
        // Task was aborted while in flight; pump next queued job
        this.pump(shard)
        return
      }
      slot.inflight.delete(msg.id)
      this.cleanupAbort(task)
      if (msg.ok) {
        task.resolve(msg.buffer ? new Uint8Array(msg.buffer) : null)
      } else {
        task.reject(new Error(msg.message || 'World worker failed'))
      }
      this.pump(shard)
    })

    const handleCrash = (err: Error): void => {
      if (slot.worker === w) slot.worker = null
      for (const task of slot.inflight.values()) {
        this.cleanupAbort(task)
        task.reject(err)
      }
      slot.inflight.clear()
      if (!this.disposed && slot.queue.length > 0) {
        this.pump(shard)
      }
    }

    w.on('error', (err: Error) => handleCrash(err))
    w.on('exit', (code: number) => {
      if (this.disposed) return
      handleCrash(new Error(`World worker exited unexpectedly (code ${code})`))
    })

    return w
  }

  private pump(shard: number): void {
    if (this.disposed) return
    const slot = this.slots[shard]
    while (slot.inflight.size < this.maxPerWorker && slot.queue.length > 0) {
      const next = slot.queue.shift()!
      if (next.signal?.aborted) {
        this.cleanupAbort(next)
        next.reject(abortError())
        continue
      }
      const worker = this.ensureWorker(shard)
      next.dispatched = true
      slot.inflight.set(next.req.id, next)
      worker.postMessage(next.req)
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    const err = abortError()
    for (const slot of this.slots) {
      for (const task of slot.queue) {
        this.cleanupAbort(task)
        task.reject(err)
      }
      slot.queue = []
      for (const task of slot.inflight.values()) {
        this.cleanupAbort(task)
        task.reject(err)
      }
      slot.inflight.clear()
      if (slot.worker) {
        void slot.worker.terminate()
        slot.worker = null
      }
    }
  }
}
