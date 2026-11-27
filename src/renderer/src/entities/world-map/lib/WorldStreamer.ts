// Dual-LOD BlueMap/Voxy-inspired world tile & chunk streamer backed by a Web Worker pool.
// Streams distance-scaled LOD-1..3 lowres regions across the horizon (up to 11x11 regions = 5632x5632 blocks)
// and LOD-0 textured 3D voxel chunks around the camera, using shared unmasked Early-Z materials,
// compact packed vertices, O(1) worker-computed bounds, stale-request cancellation, and paced GPU mounting.
import * as THREE from 'three'
import { NO_HEIGHT } from '@shared/world-tiles'
import {
  CUTOUT,
  LIQUID,
  OPAQUE,
  TRANSLUCENT,
  type Resources
} from '@/entities/viewer/lib/render/resources'
import {
  buildBlockAtlasMap,
  FALLBACK_COLORS,
  loadWorldColors,
  type BlockAtlasMap,
  type Rgb
} from './color-table'
import {
  buildQuadIndices,
  UNTEXTURED,
  type HiresMeshResult,
  type LowresLod,
  type LowresMeshResult,
  type MeshBucketBuffer,
  type WorkerErrorResult
} from './world-mesher.worker'
import type { Box2D, CameraMode, StreamStats, WorldDataSource } from '../model/types'

export interface WorkerLike {
  onmessage:
    ((e: MessageEvent<LowresMeshResult | HiresMeshResult | WorkerErrorResult>) => void) | null
  onerror: ((e: ErrorEvent) => void) | null
  onmessageerror: ((e: MessageEvent) => void) | null
  postMessage(message: unknown, transfer?: Transferable[]): void
  terminate(): void
}

export interface WorldStreamerOptions {
  createWorker?: () => WorkerLike
  workerCount?: number
  loadColors?: () => Promise<Record<string, Rgb>>
  onTerrainBounds?: (bounds: Box2D) => void
}

interface PendingJob {
  worker: WorkerLike
  resolve: (msg: LowresMeshResult | HiresMeshResult) => void
  reject: (err: Error) => void
}

interface InflightLowres {
  ctrl: AbortController
  rx: number
  rz: number
  lod: LowresLod
}

interface InflightHires {
  ctrl: AbortController
  cx: number
  cz: number
}

type QueuedMount =
  | {
      kind: 'lowres'
      key: string
      rx: number
      rz: number
      /** LOD that was requested (the mesher may fall back to a finer one for small tiles). */
      reqLod: LowresLod
      gen: number
      res: LowresMeshResult
    }
  | {
      kind: 'hires'
      key: string
      cx: number
      cz: number
      gen: number
      hGen: number
      res: HiresMeshResult
    }

export const MAX_LOWRES_REGIONS = 121 // up to 11x11 regions = 5632 x 5632 blocks
export const MAX_HIRES_CHUNKS = 121 // up to 11x11 chunks = 176 x 176 blocks in full 3D
const MAX_INFLIGHT_LOWRES = 2
const MAX_INFLIGHT_HIRES = 4
const MAX_MOUNT_QUEUE = 6
const MAX_EVICT_CHUNKS_PER_SWEEP = 4
const MAX_EVICT_REGIONS_PER_SWEEP = 2
const INITIAL_SHARED_QUADS = 131072

interface RegionEntry {
  key: string
  rx: number
  rz: number
  lod: LowresLod
  /** LOD requested for this mesh; compared against lowresLodFor() to decide up/downgrades. */
  reqLod: LowresLod
  group: THREE.Group
  terrainMesh: THREE.Mesh | null
  waterMesh: THREE.Mesh | null
  hiresCount: number
  maskedTerrainMat: THREE.MeshLambertMaterial | null
  maskedWaterMat: THREE.MeshLambertMaterial | null
  maskData: Uint8Array | null
  maskTex: THREE.DataTexture | null
  surfaceY: Int16Array
  grid: number
  step: number
  lastUsed: number
}

interface ChunkEntry {
  key: string
  cx: number
  cz: number
  group: THREE.Group
  surfaceY: Int16Array
  lastUsed: number
}

/** Drop the JS copy once the attribute is on the GPU; context loss re-streams via reload(). */
function releaseArray(this: THREE.BufferAttribute): void {
  ;(this as { array: THREE.TypedArray | null }).array = null
}

/** Compute desired lowres region radius around target from camera distance and mode. */
export function lowresRadiusFor(camDist: number, camMode: CameraMode): number {
  if (camMode === 'top') {
    return Math.min(5, Math.max(2, Math.ceil(camDist / 380)))
  }
  if (camDist >= 1750) return 5
  if (camDist >= 950) return 4
  if (camDist >= 450) return 3
  return 2
}

/** Choose Voxy-style power-of-2 detail level for a region by Chebyshev distance from the focus region. */
export function lowresLodFor(
  rx: number,
  rz: number,
  centerRx: number,
  centerRz: number
): LowresLod {
  const cheb = Math.max(Math.abs(rx - centerRx), Math.abs(rz - centerRz))
  if (cheb <= 1) return 0 // 256x256 (step 2) — crisp near terrain
  if (cheb <= 3) return 1 // 128x128 (step 4) — 4x fewer quads
  return 2 // 64x64 (step 8) — 16x fewer quads on far horizon
}

/** Patch a MeshLambertMaterial to discard fragments whose chunk (in region UV 0..1) is loaded at LOD-0. */
function attachChunkMask(mat: THREE.MeshLambertMaterial, maskTex: THREE.DataTexture): void {
  mat.userData.maskTex = maskTex
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uHiresMask = { value: maskTex }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vRegionUv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRegionUv = uv;')
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform sampler2D uHiresMask;\nvarying vec2 vRegionUv;'
      )
      .replace(
        '#include <clipping_planes_fragment>',
        '#include <clipping_planes_fragment>\nif (texture2D(uHiresMask, vRegionUv).r > 0.5) discard;'
      )
  }
  mat.customProgramCacheKey = () => 'world-lowres-masked-v1'
}

export class WorldStreamer {
  readonly lowresGroup = new THREE.Group()
  readonly hiresGroup = new THREE.Group()

  private workers: WorkerLike[] = []
  private nextWorker = 0
  private nextJobId = 1
  private pendingJobs = new Map<number, PendingJob>()

  private source: WorldDataSource | null = null
  private availableRegions: Set<string> | null = null
  private regions = new Map<string, RegionEntry>()
  private chunks = new Map<string, ChunkEntry>()
  private emptyRegions = new Set<string>()
  private emptyChunks = new Set<string>()
  private failedRegions = new Set<string>()
  private failedChunks = new Set<string>()
  private inflightLowres = new Map<string, InflightLowres>()
  private inflightHires = new Map<string, InflightHires>()
  private queuedLowres = new Set<string>()
  private queuedHires = new Set<string>()
  private mountQueue: QueuedMount[] = []
  private deferredMounts = false
  private pumpRequested = false
  private lastFlushWasHeavy = false

  private sharedIndex: THREE.BufferAttribute | null = null
  private sharedIndexQuads = 0

  // Shared unmasked Early-Z materials used by all regions with zero hires chunks (~96-99% of the map)
  private sharedLowresTerrainMat = new THREE.MeshLambertMaterial({ vertexColors: true })
  private sharedLowresWaterMat = new THREE.MeshLambertMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.78,
    depthWrite: false
  })

  private hiresMaterials: THREE.MeshLambertMaterial[]
  private resources: Resources | null = null
  private colors: Record<string, Rgb> = { ...FALLBACK_COLORS }
  private atlas: BlockAtlasMap | null = null
  private generation = 0
  private hiresGen = 0
  private tick = 0
  private centerRx = 0
  private centerRz = 0
  // Last heightAt() hits: ray-march steps mostly stay in one chunk/region, so skip the string-key Map lookup
  private lastChunk: ChunkEntry | null = null
  private lastRegion: RegionEntry | null = null
  private lastError: string | null = null
  private lastStats: StreamStats | null = null
  private statsListeners = new Set<(stats: StreamStats) => void>()
  private onTerrainBounds?: (bounds: Box2D) => void
  private disposed = false

  constructor(
    private onInvalidate: () => void,
    onStats?: (stats: StreamStats) => void,
    options?: WorldStreamerOptions
  ) {
    this.lowresGroup.name = 'world-lowres'
    this.lowresGroup.matrixAutoUpdate = false
    this.lowresGroup.updateMatrix()
    this.hiresGroup.name = 'world-hires'
    this.hiresGroup.matrixAutoUpdate = false
    this.hiresGroup.updateMatrix()
    if (onStats) this.statsListeners.add(onStats)
    this.onTerrainBounds = options?.onTerrainBounds
    this.hiresMaterials = this.createHiresMaterials(null)
    this.spawnWorkers(options)
    const loadColors = options?.loadColors ?? loadWorldColors
    void loadColors()
      .then((c) => {
        if (this.disposed) return
        this.colors = c
        if (this.resources) {
          this.atlas = buildBlockAtlasMap(this.resources, Object.keys(this.colors))
        }
        this.broadcastWorkerInit()
      })
      .catch(() => {
        // Keep FALLBACK_COLORS when block_colors.json is unavailable
      })
  }

  /** Subscribe to stream stats updates without forcing parent React re-renders. */
  subscribeStats(listener: (stats: StreamStats) => void): () => void {
    this.statsListeners.add(listener)
    if (this.lastStats) listener(this.lastStats)
    return () => {
      this.statsListeners.delete(listener)
    }
  }

  /** Enable frame-budgeted mounting driven by WorldScene's rAF loop. */
  setDeferredMounts(enabled: boolean): void {
    this.deferredMounts = enabled
    if (!enabled) this.flushMounts(Infinity)
  }

  hasPendingMounts(): boolean {
    return this.mountQueue.length > 0
  }

  needsPump(): boolean {
    return this.pumpRequested
  }

  /** Whether the most recent flushMounts call uploaded a full-detail LOD-0 region mesh. */
  lastFlushHeavy(): boolean {
    return this.lastFlushWasHeavy
  }

  /** Drain queued worker meshes within a per-frame time and count budget to prevent GPU upload hitches. */
  flushMounts(budgetMs = 2, maxItems = 2): boolean {
    this.lastFlushWasHeavy = false
    if (!this.mountQueue.length) return false
    const start = performance.now()
    let mountedAny = false
    let mountedCount = 0
    let mountedRegions = 0

    while (this.mountQueue.length > 0) {
      const item = this.mountQueue.shift()!
      if (item.kind === 'lowres') this.queuedLowres.delete(item.key)
      else this.queuedHires.delete(item.key)
      if (this.disposed || item.gen !== this.generation) continue
      if (item.kind === 'lowres') {
        const existing = this.regions.get(item.key)
        // Skip meshes whose LOD is already mounted or no longer wanted at the current focus
        if (existing?.reqLod === item.reqLod) continue
        if (item.reqLod !== lowresLodFor(item.rx, item.rz, this.centerRx, this.centerRz)) continue
        this.mountLowres(item.key, item.res, item.reqLod)
        mountedAny = true
        mountedRegions++
        mountedCount++
        if (item.res.lod === 0) this.lastFlushWasHeavy = true
      } else {
        if (item.hGen !== this.hiresGen) continue
        this.mountHires(item.key, item.res)
        mountedAny = true
        mountedCount++
      }
      // At most one lowres region or maxItems hires chunks per frame when frame-budgeted
      if (
        Number.isFinite(budgetMs) &&
        (mountedRegions >= 1 || mountedCount >= maxItems || performance.now() - start >= budgetMs)
      ) {
        break
      }
    }

    if (mountedAny) {
      // Request a pump if mountQueue dropped below backpressure cap so streaming continues smoothly
      if (this.mountQueue.length < MAX_MOUNT_QUEUE) this.pumpRequested = true
      this.emitStats()
    }
    return mountedAny
  }

  private ensureSharedIndex(quadCount: number): THREE.BufferAttribute {
    if (this.sharedIndex && quadCount <= this.sharedIndexQuads) {
      return this.sharedIndex
    }
    const nextQuads = Math.max(quadCount, this.sharedIndexQuads * 2, INITIAL_SHARED_QUADS)
    const nextAttr = new THREE.BufferAttribute(buildQuadIndices(nextQuads), 1)
    this.sharedIndex = nextAttr
    this.sharedIndexQuads = nextQuads

    // Re-point existing mounted geometries (and hires pick proxies) to the enlarged shared index buffer
    const rebind = (group: THREE.Group): void => {
      group.traverse((o) => {
        if (o instanceof THREE.Mesh && o.geometry instanceof THREE.BufferGeometry) {
          o.geometry.setIndex(nextAttr)
          ;(o.userData.pick as THREE.Mesh | undefined)?.geometry.setIndex(nextAttr)
        }
      })
    }
    rebind(this.lowresGroup)
    rebind(this.hiresGroup)
    return nextAttr
  }

  /** Build a GPU-only geometry; `keepPositions` keeps the position array for exact hires picking. */
  private buildGeometry(buf: MeshBucketBuffer, keepPositions = false): THREE.BufferGeometry | null {
    if (!buf.quadCount || !buf.positions.length) return null
    const g = new THREE.BufferGeometry()
    const position = new THREE.BufferAttribute(buf.positions, 3, false)
    if (!keepPositions) position.onUpload(releaseArray)
    g.setAttribute('position', position)
    // 4-component normals/colors: ANGLE's D3D11 backend CPU-converts 3-byte vertex formats into extra copies
    g.setAttribute('normal', new THREE.BufferAttribute(buf.normals, 4, true).onUpload(releaseArray))
    g.setAttribute(
      'uv',
      new THREE.BufferAttribute(buf.uvs, 2, buf.uvs instanceof Uint8Array).onUpload(releaseArray)
    )
    g.setAttribute('color', new THREE.BufferAttribute(buf.colors, 4, true).onUpload(releaseArray))
    g.setIndex(this.ensureSharedIndex(buf.quadCount))
    g.setDrawRange(0, buf.quadCount * 6)
    if (buf.bounds) {
      const [minX, minY, minZ, maxX, maxY, maxZ] = buf.bounds
      g.boundingBox = new THREE.Box3(
        new THREE.Vector3(minX, minY, minZ),
        new THREE.Vector3(maxX, maxY, maxZ)
      )
      g.boundingSphere = g.boundingBox.getBoundingSphere(new THREE.Sphere())
    } else {
      g.computeBoundingBox()
      g.computeBoundingSphere()
    }
    return g
  }

  private createHiresMaterials(res: Resources | null): THREE.MeshLambertMaterial[] {
    const map = res?.texture ?? null
    return [OPAQUE, CUTOUT, TRANSLUCENT, LIQUID, UNTEXTURED].map((k) => {
      const m = new THREE.MeshLambertMaterial({
        map: k === UNTEXTURED ? null : map,
        vertexColors: true,
        alphaTest: k === CUTOUT ? 0.5 : k === OPAQUE || k === UNTEXTURED ? 0 : 0.01,
        transparent: k === TRANSLUCENT || k === LIQUID,
        opacity: k === LIQUID ? 0.78 : 1,
        depthWrite: k === OPAQUE || k === CUTOUT || k === UNTEXTURED
      })
      m.userData = { bucket: k }
      return m
    })
  }

  private rejectWorkerJobs(worker: WorkerLike, message: string): void {
    const err = new Error(message)
    for (const [id, job] of this.pendingJobs) {
      if (job.worker !== worker) continue
      this.pendingJobs.delete(id)
      job.reject(err)
    }
  }

  private spawnWorkers(options?: WorldStreamerOptions): void {
    const defaultCreate = (): WorkerLike =>
      new Worker(new URL('./world-mesher.worker.ts', import.meta.url), {
        type: 'module'
      })
    const create = options?.createWorker ?? (typeof Worker !== 'undefined' ? defaultCreate : null)
    if (!create) return
    const hw = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4
    // Keep mesher worker count gentle (<= 2) so Chromium's UI/compositor threads stay responsive
    const count = options?.workerCount ?? Math.max(1, Math.min(2, Math.floor(hw / 2)))
    for (let i = 0; i < count; i++) {
      const w = create()
      w.onmessage = (e: MessageEvent<LowresMeshResult | HiresMeshResult | WorkerErrorResult>) => {
        const job = this.pendingJobs.get(e.data.id)
        if (!job) return
        this.pendingJobs.delete(e.data.id)
        if (e.data.type === 'error') {
          job.reject(new Error(e.data.message || 'World mesher worker error'))
        } else {
          job.resolve(e.data)
        }
      }
      w.onerror = (e: ErrorEvent) => {
        const msg = e.message || 'World mesher worker failed'
        this.rejectWorkerJobs(w, msg)
      }
      w.onmessageerror = () => {
        this.rejectWorkerJobs(w, 'World mesher worker message error')
      }
      this.workers.push(w)
    }
  }

  private broadcastWorkerInit(): void {
    for (const w of this.workers) {
      w.postMessage({ type: 'init', colors: this.colors, atlas: this.atlas })
    }
  }

  /** Attach or update Builder Studio's jar texture pack resources for textured 3D voxel chunks. */
  setResources(res: Resources | null): void {
    const prevMats = this.hiresMaterials
    this.resources = res
    this.hiresMaterials = this.createHiresMaterials(res)
    this.atlas = buildBlockAtlasMap(res, Object.keys(this.colors))
    this.broadcastWorkerInit()

    // Re-stream hires chunks with the new textures
    this.clearHires()
    prevMats.forEach((m) => m.dispose())
    this.pumpRequested = true
    this.onInvalidate()
  }

  /** Switch to a different world or dimension, clearing cached meshes and aborting old fetches. */
  setSource(source: WorldDataSource | null): void {
    if (this.source?.key === source?.key) return
    this.generation++
    this.abortAll()
    this.mountQueue = []
    this.queuedLowres.clear()
    this.queuedHires.clear()
    this.clearHires()
    this.clearLowres()
    this.emptyRegions.clear()
    this.emptyChunks.clear()
    this.failedRegions.clear()
    this.failedChunks.clear()
    this.lastError = null
    this.source = source
    this.availableRegions = source?.regions
      ? new Set(source.regions.map(([rx, rz]) => `${rx},${rz}`))
      : null
    this.pumpRequested = !!source
    this.emitStats()
    this.onInvalidate()
  }

  /** Drop every mounted mesh and stream again (after WebGL context loss: GPU buffers are gone, CPU copies were released). */
  reload(): void {
    this.generation++
    this.abortAll()
    this.mountQueue = []
    this.queuedLowres.clear()
    this.queuedHires.clear()
    this.clearHires()
    this.clearLowres()
    this.pumpRequested = !!this.source
    this.emitStats()
    this.onInvalidate()
  }

  /** Update streaming around camera focus (targetX, targetZ) given camera mode, distance, and forward XZ direction. */
  update(
    targetX: number,
    targetZ: number,
    camDist: number,
    camMode: CameraMode,
    fwdX = 0,
    fwdZ = 0
  ): void {
    this.pumpRequested = false
    if (!this.source || this.disposed) return
    this.tick++
    const gen = this.generation
    const hGen = this.hiresGen

    const fwdLen = Math.hypot(fwdX, fwdZ)
    const fx = fwdLen > 1e-4 ? fwdX / fwdLen : 0
    const fz = fwdLen > 1e-4 ? fwdZ / fwdLen : 0

    // 1. Stream distance-scaled lowres regions in an adaptive radius up to 5 regions (11x11 = 5632x5632 blocks)
    const centerRx = Math.floor(targetX / 512)
    const centerRz = Math.floor(targetZ / 512)
    this.centerRx = centerRx
    this.centerRz = centerRz
    const lowRadius = lowresRadiusFor(camDist, camMode)

    const wantsHires = camMode !== 'top' ? camDist < 260 : camDist < 140
    const hiresRadius = !wantsHires
      ? 0
      : camMode === '3d'
        ? camDist < 120
          ? 5
          : 4
        : camMode === 'iso'
          ? 4
          : 3

    // Abort out-of-range inflight requests and prune stale mountQueue entries so fast panning never builds backlog
    this.cancelStaleRequests(targetX, targetZ, centerRx, centerRz, lowRadius, hiresRadius)

    const desiredRegions: { rx: number; rz: number; lod: LowresLod; score: number; key: string }[] =
      []
    for (let rz = centerRz - lowRadius; rz <= centerRz + lowRadius; rz++) {
      for (let rx = centerRx - lowRadius; rx <= centerRx + lowRadius; rx++) {
        const key = `${rx},${rz}`
        if (this.availableRegions && !this.availableRegions.has(key)) continue
        const desiredLod = lowresLodFor(rx, rz, centerRx, centerRz)
        const existing = this.regions.get(key)
        if (existing) {
          existing.lastUsed = this.tick
          // Re-mesh in place when the wanted LOD changed: finer on approach, coarser when far (frees memory)
          if (existing.reqLod === desiredLod) continue
        }
        if (
          this.emptyRegions.has(key) ||
          this.failedRegions.has(key) ||
          this.inflightLowres.has(key) ||
          this.queuedLowres.has(key)
        ) {
          continue
        }
        const dx = (rx + 0.5) * 512 - targetX
        const dz = (rz + 0.5) * 512 - targetZ
        const d = Math.hypot(dx, dz)
        const align = d > 1 && fwdLen > 1e-4 ? (dx * fx + dz * fz) / d : 0
        // Prioritize missing regions ahead of the camera; upgrades sort after missing ones, downgrades last
        const upgradePenalty = !existing ? 0 : desiredLod < existing.reqLod ? 900 : 2400
        const score = d * (1 - 0.35 * align) + upgradePenalty
        desiredRegions.push({ rx, rz, lod: desiredLod, score, key })
      }
    }

    if (this.mountQueue.length < MAX_MOUNT_QUEUE) {
      desiredRegions.sort((a, b) => a.score - b.score)
      for (const r of desiredRegions) {
        if (this.inflightLowres.size >= MAX_INFLIGHT_LOWRES) break
        this.startLowres(r.rx, r.rz, r.lod, r.key, gen)
      }
    }

    // 2. Stream LOD-0 hires voxel chunks when close enough to appreciate full 3D blocks
    if (hiresRadius > 0) {
      const centerCx = Math.floor(targetX / 16)
      const centerCz = Math.floor(targetZ / 16)
      const desiredChunks: { cx: number; cz: number; score: number; key: string }[] = []

      for (let cz = centerCz - hiresRadius; cz <= centerCz + hiresRadius; cz++) {
        for (let cx = centerCx - hiresRadius; cx <= centerCx + hiresRadius; cx++) {
          const rKey = `${cx >> 5},${cz >> 5}`
          if (this.availableRegions && !this.availableRegions.has(rKey)) continue
          const dx = (cx + 0.5) * 16 - targetX
          const dz = (cz + 0.5) * 16 - targetZ
          const d = Math.hypot(dx, dz)
          if (d > (hiresRadius + 0.5) * 16) continue
          const key = `${cx},${cz}`
          const existing = this.chunks.get(key)
          if (existing) {
            existing.lastUsed = this.tick
            continue
          }
          if (
            this.emptyChunks.has(key) ||
            this.failedChunks.has(key) ||
            this.inflightHires.has(key) ||
            this.queuedHires.has(key)
          ) {
            continue
          }
          const align = d > 1 && fwdLen > 1e-4 ? (dx * fx + dz * fz) / d : 0
          const score = d * (1 - 0.3 * align)
          desiredChunks.push({ cx, cz, score, key })
        }
      }
      if (this.mountQueue.length < MAX_MOUNT_QUEUE) {
        desiredChunks.sort((a, b) => a.score - b.score)
        for (const c of desiredChunks) {
          if (this.inflightHires.size >= MAX_INFLIGHT_HIRES) break
          this.startHires(c.cx, c.cz, c.key, gen, hGen)
        }
      }
    }

    // Hysteresis: hires chunks load below 260 (140 top-down) and are dropped only well past that
    const dropHires = camMode !== 'top' ? camDist >= 330 : camDist >= 190
    this.evictOutOfRange(centerRx, centerRz, lowRadius + 1, targetX, targetZ, hiresRadius, dropHires)
    this.evictLru(targetX, targetZ)
    this.emitStats()
  }

  /** Unload regions/chunks outside the view radius (paced per sweep) instead of waiting for the 121 caps. */
  private evictOutOfRange(
    centerRx: number,
    centerRz: number,
    maxCheb: number,
    targetX: number,
    targetZ: number,
    hiresRadius: number,
    dropHires: boolean
  ): void {
    let regionsLeft = MAX_EVICT_REGIONS_PER_SWEEP
    for (const r of this.regions.values()) {
      if (Math.max(Math.abs(r.rx - centerRx), Math.abs(r.rz - centerRz)) <= maxCheb) continue
      if (regionsLeft-- <= 0) {
        this.pumpRequested = true
        break
      }
      this.regions.delete(r.key)
      this.disposeRegion(r)
    }
    if (hiresRadius === 0 && !dropHires) return
    const maxDist = hiresRadius > 0 ? (hiresRadius + 2) * 16 : -1
    let chunksLeft = MAX_EVICT_CHUNKS_PER_SWEEP
    for (const c of this.chunks.values()) {
      if (maxDist >= 0 && Math.hypot((c.cx + 0.5) * 16 - targetX, (c.cz + 0.5) * 16 - targetZ) <= maxDist) {
        continue
      }
      if (chunksLeft-- <= 0) {
        this.pumpRequested = true
        break
      }
      this.chunks.delete(c.key)
      this.disposeChunk(c)
    }
  }

  private cancelStaleRequests(
    targetX: number,
    targetZ: number,
    centerRx: number,
    centerRz: number,
    lowRadius: number,
    hiresRadius: number
  ): void {
    const maxLowCheb = lowRadius + 1
    for (const [key, entry] of this.inflightLowres) {
      if (Math.max(Math.abs(entry.rx - centerRx), Math.abs(entry.rz - centerRz)) > maxLowCheb) {
        this.inflightLowres.delete(key)
        entry.ctrl.abort()
      }
    }

    const maxHiresDist = hiresRadius > 0 ? (hiresRadius + 1.5) * 16 : -1
    for (const [key, entry] of this.inflightHires) {
      if (
        maxHiresDist < 0 ||
        Math.hypot((entry.cx + 0.5) * 16 - targetX, (entry.cz + 0.5) * 16 - targetZ) > maxHiresDist
      ) {
        this.inflightHires.delete(key)
        entry.ctrl.abort()
      }
    }

    if (this.mountQueue.length > 0) {
      const kept: QueuedMount[] = []
      for (const item of this.mountQueue) {
        if (item.kind === 'lowres') {
          if (Math.max(Math.abs(item.rx - centerRx), Math.abs(item.rz - centerRz)) > maxLowCheb) {
            this.queuedLowres.delete(item.key)
            continue
          }
        } else if (
          maxHiresDist < 0 ||
          Math.hypot((item.cx + 0.5) * 16 - targetX, (item.cz + 0.5) * 16 - targetZ) > maxHiresDist
        ) {
          this.queuedHires.delete(item.key)
          continue
        }
        kept.push(item)
      }
      this.mountQueue = kept
    }
  }

  /** Fast top-block Y lookup at world (x, z): checks hires chunks first (1-block exact), then lowres regions. */
  heightAt(x: number, z: number): number | null {
    const ix = Math.floor(x)
    const iz = Math.floor(z)
    const cx = ix >> 4
    const cz = iz >> 4
    let chunk = this.lastChunk
    if (!chunk || chunk.cx !== cx || chunk.cz !== cz) {
      chunk = this.chunks.get(`${cx},${cz}`) ?? null
      if (chunk) this.lastChunk = chunk
    }
    if (chunk) {
      const lx = ix & 15
      const lz = iz & 15
      const y = chunk.surfaceY[lz * 16 + lx]
      if (y !== NO_HEIGHT) return y
    }
    const rx = ix >> 9
    const rz = iz >> 9
    let reg = this.lastRegion
    if (!reg || reg.rx !== rx || reg.rz !== rz) {
      reg = this.regions.get(`${rx},${rz}`) ?? null
      if (reg) this.lastRegion = reg
    }
    if (reg) {
      const gx = Math.min(reg.grid - 1, Math.max(0, Math.floor((ix - rx * 512) / reg.step)))
      const gz = Math.min(reg.grid - 1, Math.max(0, Math.floor((iz - rz * 512) / reg.step)))
      const y = reg.surfaceY[gz * reg.grid + gx]
      if (y !== NO_HEIGHT) return y
    }
    return null
  }

  private runWorker<T extends LowresMeshResult | HiresMeshResult>(
    type: 'lowres' | 'hires',
    buffer: ArrayBuffer,
    lod?: LowresLod
  ): Promise<T> {
    if (!this.workers.length) {
      return Promise.reject(new Error('World mesher worker unavailable'))
    }
    const id = this.nextJobId++
    const worker = this.workers[this.nextWorker++ % this.workers.length]
    return new Promise((resolve, reject) => {
      this.pendingJobs.set(id, {
        worker,
        resolve: resolve as (msg: LowresMeshResult | HiresMeshResult) => void,
        reject
      })
      const payload = type === 'lowres' ? { type, id, buffer, lod: lod ?? 0 } : { type, id, buffer }
      worker.postMessage(payload, [buffer])
    })
  }

  private recordFailure(kind: 'region' | 'chunk', key: string, err: unknown, gen: number): void {
    if (this.disposed || gen !== this.generation) return
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[world-map] Failed to load ${kind} ${key}:`, err)
    if (kind === 'region') this.failedRegions.add(key)
    else this.failedChunks.add(key)
    this.lastError = message || `Could not load world ${kind}`
  }

  private startLowres(rx: number, rz: number, lod: LowresLod, key: string, gen: number): void {
    const src = this.source
    if (!src) return
    const ctrl = new AbortController()
    const entry: InflightLowres = { ctrl, rx, rz, lod }
    this.inflightLowres.set(key, entry)
    void src
      .fetchLowres(rx, rz, ctrl.signal)
      .then(async (buf) => {
        if (this.disposed || gen !== this.generation || ctrl.signal.aborted) return
        if (!buf) {
          this.emptyRegions.add(key)
          return
        }
        const mesh = await this.runWorker<LowresMeshResult>('lowres', buf, lod)
        if (this.disposed || gen !== this.generation || ctrl.signal.aborted) return
        if (this.deferredMounts) {
          this.queuedLowres.add(key)
          this.mountQueue.push({ kind: 'lowres', key, rx, rz, reqLod: lod, gen, res: mesh })
          this.onInvalidate()
        } else {
          this.mountLowres(key, mesh, lod)
        }
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted || (err instanceof Error && err.name === 'AbortError')) return
        this.recordFailure('region', key, err, gen)
      })
      .finally(() => {
        if (this.inflightLowres.get(key) === entry) this.inflightLowres.delete(key)
        if (!this.disposed && gen === this.generation) {
          this.pumpRequested = true
          this.onInvalidate()
        }
        this.emitStats()
      })
  }

  private startHires(cx: number, cz: number, key: string, gen: number, hGen: number): void {
    const src = this.source
    if (!src) return
    const ctrl = new AbortController()
    const entry: InflightHires = { ctrl, cx, cz }
    this.inflightHires.set(key, entry)
    void src
      .fetchHires(cx, cz, ctrl.signal)
      .then(async (buf) => {
        if (
          this.disposed ||
          gen !== this.generation ||
          hGen !== this.hiresGen ||
          ctrl.signal.aborted
        )
          return
        if (!buf) {
          this.emptyChunks.add(key)
          return
        }
        const mesh = await this.runWorker<HiresMeshResult>('hires', buf)
        if (
          this.disposed ||
          gen !== this.generation ||
          hGen !== this.hiresGen ||
          ctrl.signal.aborted
        )
          return
        if (this.deferredMounts) {
          this.queuedHires.add(key)
          this.mountQueue.push({ kind: 'hires', key, cx, cz, gen, hGen, res: mesh })
          this.onInvalidate()
        } else {
          this.mountHires(key, mesh)
        }
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted || (err instanceof Error && err.name === 'AbortError')) return
        if (hGen !== this.hiresGen) return
        this.recordFailure('chunk', key, err, gen)
      })
      .finally(() => {
        if (this.inflightHires.get(key) === entry) this.inflightHires.delete(key)
        if (!this.disposed && gen === this.generation && hGen === this.hiresGen) {
          this.pumpRequested = true
          this.onInvalidate()
        }
        this.emitStats()
      })
  }

  private enableRegionMask(reg: RegionEntry): void {
    if (reg.maskData) return
    const maskData = new Uint8Array(32 * 32 * 4)
    const maskTex = new THREE.DataTexture(maskData, 32, 32, THREE.RGBAFormat)
    maskTex.magFilter = THREE.NearestFilter
    maskTex.minFilter = THREE.NearestFilter
    maskTex.generateMipmaps = false
    maskTex.needsUpdate = true

    const maskedTerrainMat = new THREE.MeshLambertMaterial({ vertexColors: true })
    attachChunkMask(maskedTerrainMat, maskTex)
    const maskedWaterMat = new THREE.MeshLambertMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.78,
      depthWrite: false
    })
    attachChunkMask(maskedWaterMat, maskTex)

    reg.maskData = maskData
    reg.maskTex = maskTex
    reg.maskedTerrainMat = maskedTerrainMat
    reg.maskedWaterMat = maskedWaterMat
    if (reg.terrainMesh) reg.terrainMesh.material = maskedTerrainMat
    if (reg.waterMesh) reg.waterMesh.material = maskedWaterMat
  }

  private disableRegionMask(reg: RegionEntry): void {
    if (!reg.maskData) return
    if (reg.terrainMesh) reg.terrainMesh.material = this.sharedLowresTerrainMat
    if (reg.waterMesh) reg.waterMesh.material = this.sharedLowresWaterMat
    reg.maskedTerrainMat?.dispose()
    reg.maskedWaterMat?.dispose()
    reg.maskTex?.dispose()
    reg.maskedTerrainMat = null
    reg.maskedWaterMat = null
    reg.maskTex = null
    reg.maskData = null
  }

  private mountLowres(key: string, res: LowresMeshResult, reqLod: LowresLod): void {
    const existing = this.regions.get(key)
    if (existing) this.disposeRegion(existing)

    const group = new THREE.Group()
    group.name = `r.${res.rx}.${res.rz}`
    group.matrixAutoUpdate = false
    group.updateMatrix()

    let terrainMesh: THREE.Mesh | null = null
    const tGeo = this.buildGeometry(res.terrain)
    if (tGeo) {
      terrainMesh = new THREE.Mesh(tGeo, this.sharedLowresTerrainMat)
      terrainMesh.userData.isTerrain = true
      terrainMesh.matrixAutoUpdate = false
      terrainMesh.updateMatrix()
      group.add(terrainMesh)
    }

    let waterMesh: THREE.Mesh | null = null
    const wGeo = this.buildGeometry(res.water)
    if (wGeo) {
      waterMesh = new THREE.Mesh(wGeo, this.sharedLowresWaterMat)
      waterMesh.renderOrder = 1
      waterMesh.matrixAutoUpdate = false
      waterMesh.updateMatrix()
      group.add(waterMesh)
    }

    const entry: RegionEntry = {
      key,
      rx: res.rx,
      rz: res.rz,
      lod: res.lod,
      reqLod,
      group,
      terrainMesh,
      waterMesh,
      hiresCount: 0,
      maskedTerrainMat: null,
      maskedWaterMat: null,
      maskData: null,
      maskTex: null,
      surfaceY: res.surfaceY,
      grid: res.grid,
      step: res.step,
      lastUsed: this.tick
    }

    // Only allocate a masked discard shader + texture if hires chunks already exist inside this region
    if (this.chunks.size > 0) {
      const baseCx = res.rx * 32
      const baseCz = res.rz * 32
      for (let lcz = 0; lcz < 32; lcz++) {
        for (let lcx = 0; lcx < 32; lcx++) {
          if (!this.chunks.has(`${baseCx + lcx},${baseCz + lcz}`)) continue
          if (!entry.maskData) this.enableRegionMask(entry)
          entry.maskData![(lcz * 32 + lcx) * 4] = 255
          entry.hiresCount++
        }
      }
      if (entry.maskTex) entry.maskTex.needsUpdate = true
    }

    this.lowresGroup.add(group)
    this.regions.set(key, entry)
    this.lastError = null
    this.onInvalidate()
    const ox = res.rx * 512
    const oz = res.rz * 512
    this.onTerrainBounds?.([ox, oz, ox + 511, oz + 511])
  }

  private mountHires(key: string, res: HiresMeshResult): void {
    const existing = this.chunks.get(key)
    if (existing) this.disposeChunk(existing)

    const group = new THREE.Group()
    group.name = `c.${res.cx}.${res.cz}`
    group.matrixAutoUpdate = false
    group.updateMatrix()
    for (let b = 0; b < res.buckets.length; b++) {
      const isTerrain = b === OPAQUE || b === CUTOUT || b === UNTEXTURED
      const geo = this.buildGeometry(res.buckets[b], isTerrain)
      if (!geo) continue
      const mesh = new THREE.Mesh(geo, this.hiresMaterials[b])
      if (isTerrain) {
        mesh.userData.isTerrain = true
        // Raycast proxy sharing the kept position array: three's raycast also reads uv/normal, which are released
        const pick = new THREE.BufferGeometry()
        pick.setAttribute('position', geo.getAttribute('position'))
        pick.setIndex(geo.index)
        pick.setDrawRange(0, geo.drawRange.count)
        pick.boundingBox = geo.boundingBox
        pick.boundingSphere = geo.boundingSphere
        mesh.userData.pick = new THREE.Mesh(pick)
      }
      if (b === LIQUID || b === TRANSLUCENT) mesh.renderOrder = 2
      mesh.matrixAutoUpdate = false
      mesh.updateMatrix()
      group.add(mesh)
    }
    this.hiresGroup.add(group)
    this.chunks.set(key, {
      key,
      cx: res.cx,
      cz: res.cz,
      group,
      surfaceY: res.surfaceY,
      lastUsed: this.tick
    })
    this.setRegionMaskBit(res.cx, res.cz, 255)
    this.lastError = null
    this.onInvalidate()
    const ox = res.cx * 16
    const oz = res.cz * 16
    this.onTerrainBounds?.([ox, oz, ox + 15, oz + 15])
  }

  private setRegionMaskBit(cx: number, cz: number, value: number): void {
    const rx = cx >> 5
    const rz = cz >> 5
    const reg = this.regions.get(`${rx},${rz}`)
    if (!reg) return
    const lcx = cx & 31
    const lcz = cz & 31
    const off = (lcz * 32 + lcx) * 4

    if (value > 0) {
      if (!reg.maskData) this.enableRegionMask(reg)
      if (reg.maskData![off] === 0) {
        reg.maskData![off] = 255
        reg.hiresCount++
        reg.maskTex!.needsUpdate = true
      }
    } else if (reg.maskData && reg.maskData[off] !== 0) {
      reg.maskData[off] = 0
      reg.hiresCount = Math.max(0, reg.hiresCount - 1)
      if (reg.hiresCount === 0) {
        this.disableRegionMask(reg)
      } else {
        reg.maskTex!.needsUpdate = true
      }
    }
  }

  private evictLru(targetX: number, targetZ: number): void {
    if (this.chunks.size > MAX_HIRES_CHUNKS) {
      const toEvict = Math.min(MAX_EVICT_CHUNKS_PER_SWEEP, this.chunks.size - MAX_HIRES_CHUNKS)
      const sorted = [...this.chunks.values()].sort((a, b) => {
        const da = Math.hypot((a.cx + 0.5) * 16 - targetX, (a.cz + 0.5) * 16 - targetZ)
        const db = Math.hypot((b.cx + 0.5) * 16 - targetX, (b.cz + 0.5) * 16 - targetZ)
        return db - da
      })
      for (const c of sorted.slice(0, toEvict)) {
        this.chunks.delete(c.key)
        this.disposeChunk(c)
      }
    }
    if (this.regions.size > MAX_LOWRES_REGIONS) {
      const toEvict = Math.min(MAX_EVICT_REGIONS_PER_SWEEP, this.regions.size - MAX_LOWRES_REGIONS)
      const sorted = [...this.regions.values()].sort((a, b) => {
        const da = Math.hypot((a.rx + 0.5) * 512 - targetX, (a.rz + 0.5) * 512 - targetZ)
        const db = Math.hypot((b.rx + 0.5) * 512 - targetX, (b.rz + 0.5) * 512 - targetZ)
        return db - da
      })
      for (const r of sorted.slice(0, toEvict)) {
        this.regions.delete(r.key)
        this.disposeRegion(r)
      }
    }
  }

  private disposeRegion(r: RegionEntry): void {
    if (this.lastRegion === r) this.lastRegion = null
    r.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        // Detach shared quad index before dispose so Three.js never frees the shared GPU index buffer
        o.geometry.setIndex(null)
        o.geometry.dispose()
      }
    })
    r.group.removeFromParent()
    r.maskedTerrainMat?.dispose()
    r.maskedWaterMat?.dispose()
    r.maskTex?.dispose()
  }

  private disposeChunk(c: ChunkEntry): void {
    if (this.lastChunk === c) this.lastChunk = null
    this.setRegionMaskBit(c.cx, c.cz, 0)
    c.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.setIndex(null)
        o.geometry.dispose()
      }
    })
    c.group.removeFromParent()
  }

  private clearHires(): void {
    this.hiresGen++
    for (const entry of this.inflightHires.values()) entry.ctrl.abort()
    this.inflightHires.clear()
    this.queuedHires.clear()
    this.mountQueue = this.mountQueue.filter((item) => item.kind !== 'hires')
    for (const c of this.chunks.values()) this.disposeChunk(c)
    this.chunks.clear()
  }

  private clearLowres(): void {
    for (const entry of this.inflightLowres.values()) entry.ctrl.abort()
    this.inflightLowres.clear()
    this.queuedLowres.clear()
    this.mountQueue = this.mountQueue.filter((item) => item.kind !== 'lowres')
    for (const r of this.regions.values()) this.disposeRegion(r)
    this.regions.clear()
  }

  private abortAll(): void {
    for (const entry of this.inflightLowres.values()) entry.ctrl.abort()
    for (const entry of this.inflightHires.values()) entry.ctrl.abort()
    this.inflightLowres.clear()
    this.inflightHires.clear()
  }

  private emitStats(): void {
    const next: StreamStats = {
      lowresLoaded: this.regions.size,
      hiresLoaded: this.chunks.size,
      pending: this.inflightLowres.size + this.inflightHires.size + this.mountQueue.length,
      error: this.lastError
    }
    if (
      this.lastStats &&
      this.lastStats.lowresLoaded === next.lowresLoaded &&
      this.lastStats.hiresLoaded === next.hiresLoaded &&
      this.lastStats.pending === next.pending &&
      this.lastStats.error === next.error
    ) {
      return
    }
    this.lastStats = next
    for (const listener of this.statsListeners) listener(next)
  }

  dispose(): void {
    this.disposed = true
    this.abortAll()
    this.mountQueue = []
    this.clearHires()
    this.clearLowres()
    this.sharedIndex = null
    this.sharedIndexQuads = 0
    this.sharedLowresTerrainMat.dispose()
    this.sharedLowresWaterMat.dispose()
    this.hiresMaterials.forEach((m) => m.dispose())
    this.workers.forEach((w) => w.terminate())
    this.workers = []
    this.statsListeners.clear()
    const err = new Error('WorldStreamer disposed')
    err.name = 'AbortError'
    for (const job of this.pendingJobs.values()) job.reject(err)
    this.pendingJobs.clear()
  }
}
