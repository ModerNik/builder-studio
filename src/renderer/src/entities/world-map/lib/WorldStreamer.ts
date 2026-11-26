// Dual-LOD BlueMap-style world tile & chunk streamer backed by a Web Worker pool.
// Streams LOD-1 lowres regions across the horizon and LOD-0 textured 3D voxel chunks around the camera.
// Each LOD-1 region material uses a 32x32 chunk mask texture so loaded LOD-0 chunks replace it seamlessly.
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
  UNTEXTURED,
  type HiresMeshResult,
  type LowresMeshResult,
  type MeshBucketBuffer,
  type WorkerErrorResult
} from './world-mesher.worker'
import type { CameraMode, StreamStats, WorldDataSource } from '../model/types'

export interface WorkerLike {
  onmessage: ((e: MessageEvent<LowresMeshResult | HiresMeshResult | WorkerErrorResult>) => void) | null
  onerror: ((e: ErrorEvent) => void) | null
  onmessageerror: ((e: MessageEvent) => void) | null
  postMessage(message: unknown, transfer?: Transferable[]): void
  terminate(): void
}

export interface WorldStreamerOptions {
  createWorker?: () => WorkerLike
  workerCount?: number
  loadColors?: () => Promise<Record<string, Rgb>>
}

interface PendingJob {
  worker: WorkerLike
  resolve: (msg: LowresMeshResult | HiresMeshResult) => void
  reject: (err: Error) => void
}

const STRIDE = 11
const MAX_LOWRES_REGIONS = 49 // up to 7x7 regions = 3584 x 3584 blocks
const MAX_HIRES_CHUNKS = 225 // up to 15x15 chunks = 240 x 240 blocks in full 3D
const MAX_INFLIGHT_LOWRES = 4
const MAX_INFLIGHT_HIRES = 12

interface RegionEntry {
  key: string
  rx: number
  rz: number
  group: THREE.Group
  terrainMat: THREE.MeshLambertMaterial
  waterMat: THREE.MeshLambertMaterial
  maskData: Uint8Array
  maskTex: THREE.DataTexture
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

function buildGeometry(buf: MeshBucketBuffer): THREE.BufferGeometry | null {
  if (!buf.vertices.length || !buf.indices.length) return null
  const ib = new THREE.InterleavedBuffer(buf.vertices, STRIDE)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.InterleavedBufferAttribute(ib, 3, 0))
  g.setAttribute('normal', new THREE.InterleavedBufferAttribute(ib, 3, 3))
  g.setAttribute('uv', new THREE.InterleavedBufferAttribute(ib, 2, 6))
  g.setAttribute('color', new THREE.InterleavedBufferAttribute(ib, 3, 8))
  g.setIndex(new THREE.BufferAttribute(buf.indices, 1))
  g.computeBoundingBox()
  g.computeBoundingSphere()
  return g
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
  private inflightLowres = new Map<string, AbortController>()
  private inflightHires = new Map<string, AbortController>()

  private hiresMaterials: THREE.MeshLambertMaterial[]
  private resources: Resources | null = null
  private colors: Record<string, Rgb> = { ...FALLBACK_COLORS }
  private atlas: BlockAtlasMap | null = null
  private generation = 0
  private hiresGen = 0
  private tick = 0
  private lastError: string | null = null
  private lastStats: StreamStats | null = null
  private disposed = false

  constructor(
    private onInvalidate: () => void,
    private onStats?: (stats: StreamStats) => void,
    options?: WorldStreamerOptions
  ) {
    this.lowresGroup.name = 'world-lowres'
    this.hiresGroup.name = 'world-hires'
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
    const hw = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 2 : 2
    const count = options?.workerCount ?? Math.max(2, Math.min(4, hw))
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
    this.onInvalidate()
  }

  /** Switch to a different world or dimension, clearing cached meshes and aborting old fetches. */
  setSource(source: WorldDataSource | null): void {
    if (this.source?.key === source?.key) return
    this.generation++
    this.abortAll()
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
    this.emitStats()
    this.onInvalidate()
  }

  /** Update streaming around camera focus (targetX, targetZ) given camera mode and distance. */
  update(targetX: number, targetZ: number, camDist: number, camMode: CameraMode): void {
    if (!this.source || this.disposed) return
    this.tick++
    const gen = this.generation
    const hGen = this.hiresGen

    // 1. Stream LOD-1 regions in a radius scaled to camera distance (up to 3 regions = 1536 blocks each way)
    const centerRx = Math.floor(targetX / 512)
    const centerRz = Math.floor(targetZ / 512)
    const lowRadius = camMode === 'top' ? Math.min(3, Math.max(1, Math.ceil(camDist / 380))) : 2

    const desiredRegions: { rx: number; rz: number; dist: number; key: string }[] = []
    for (let rz = centerRz - lowRadius; rz <= centerRz + lowRadius; rz++) {
      for (let rx = centerRx - lowRadius; rx <= centerRx + lowRadius; rx++) {
        const key = `${rx},${rz}`
        if (this.availableRegions && !this.availableRegions.has(key)) continue
        const existing = this.regions.get(key)
        if (existing) {
          existing.lastUsed = this.tick
          continue
        }
        if (this.emptyRegions.has(key) || this.failedRegions.has(key) || this.inflightLowres.has(key))
          continue
        const d = Math.hypot((rx + 0.5) * 512 - targetX, (rz + 0.5) * 512 - targetZ)
        desiredRegions.push({ rx, rz, dist: d, key })
      }
    }
    desiredRegions.sort((a, b) => a.dist - b.dist)
    for (const r of desiredRegions) {
      if (this.inflightLowres.size >= MAX_INFLIGHT_LOWRES) break
      this.startLowres(r.rx, r.rz, r.key, gen)
    }

    // 2. Stream LOD-0 hires voxel chunks when close enough to appreciate full 3D blocks
    const wantsHires = camMode !== 'top' ? camDist < 340 : camDist < 170
    const hiresRadius = !wantsHires
      ? 0
      : camMode === '3d'
        ? camDist < 140
          ? 7
          : 5
        : camMode === 'iso'
          ? 5
          : 4

    if (hiresRadius > 0) {
      const centerCx = Math.floor(targetX / 16)
      const centerCz = Math.floor(targetZ / 16)
      const desiredChunks: { cx: number; cz: number; dist: number; key: string }[] = []

      for (let cz = centerCz - hiresRadius; cz <= centerCz + hiresRadius; cz++) {
        for (let cx = centerCx - hiresRadius; cx <= centerCx + hiresRadius; cx++) {
          const rKey = `${cx >> 5},${cz >> 5}`
          if (this.availableRegions && !this.availableRegions.has(rKey)) continue
          const d = Math.hypot((cx + 0.5) * 16 - targetX, (cz + 0.5) * 16 - targetZ)
          if (d > (hiresRadius + 0.5) * 16) continue
          const key = `${cx},${cz}`
          const existing = this.chunks.get(key)
          if (existing) {
            existing.lastUsed = this.tick
            continue
          }
          if (this.emptyChunks.has(key) || this.failedChunks.has(key) || this.inflightHires.has(key))
            continue
          desiredChunks.push({ cx, cz, dist: d, key })
        }
      }
      desiredChunks.sort((a, b) => a.dist - b.dist)
      for (const c of desiredChunks) {
        if (this.inflightHires.size >= MAX_INFLIGHT_HIRES) break
        this.startHires(c.cx, c.cz, c.key, gen, hGen)
      }
    }

    this.evictLru(targetX, targetZ)
    this.emitStats()
  }

  /** Fast top-block Y lookup at world (x, z): checks hires chunks first (1-block exact), then lowres regions. */
  heightAt(x: number, z: number): number | null {
    const ix = Math.floor(x)
    const iz = Math.floor(z)
    const cx = ix >> 4
    const cz = iz >> 4
    const chunk = this.chunks.get(`${cx},${cz}`)
    if (chunk) {
      const lx = ix & 15
      const lz = iz & 15
      const y = chunk.surfaceY[lz * 16 + lx]
      if (y !== NO_HEIGHT) return y
    }
    const rx = ix >> 9
    const rz = iz >> 9
    const reg = this.regions.get(`${rx},${rz}`)
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
    buffer: ArrayBuffer
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
      worker.postMessage({ type, id, buffer }, [buffer])
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

  private startLowres(rx: number, rz: number, key: string, gen: number): void {
    const src = this.source
    if (!src) return
    const ctrl = new AbortController()
    this.inflightLowres.set(key, ctrl)
    void src
      .fetchLowres(rx, rz, ctrl.signal)
      .then(async (buf) => {
        if (this.disposed || gen !== this.generation) return
        if (!buf) {
          this.emptyRegions.add(key)
          return
        }
        const mesh = await this.runWorker<LowresMeshResult>('lowres', buf)
        if (this.disposed || gen !== this.generation) return
        this.mountLowres(key, mesh)
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted || (err instanceof Error && err.name === 'AbortError')) return
        this.recordFailure('region', key, err, gen)
      })
      .finally(() => {
        if (this.inflightLowres.get(key) === ctrl) this.inflightLowres.delete(key)
        this.emitStats()
      })
  }

  private startHires(cx: number, cz: number, key: string, gen: number, hGen: number): void {
    const src = this.source
    if (!src) return
    const ctrl = new AbortController()
    this.inflightHires.set(key, ctrl)
    void src
      .fetchHires(cx, cz, ctrl.signal)
      .then(async (buf) => {
        if (this.disposed || gen !== this.generation || hGen !== this.hiresGen) return
        if (!buf) {
          this.emptyChunks.add(key)
          return
        }
        const mesh = await this.runWorker<HiresMeshResult>('hires', buf)
        if (this.disposed || gen !== this.generation || hGen !== this.hiresGen) return
        this.mountHires(key, mesh)
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted || (err instanceof Error && err.name === 'AbortError')) return
        if (hGen !== this.hiresGen) return
        this.recordFailure('chunk', key, err, gen)
      })
      .finally(() => {
        if (this.inflightHires.get(key) === ctrl) this.inflightHires.delete(key)
        this.emitStats()
      })
  }

  private mountLowres(key: string, res: LowresMeshResult): void {
    const existing = this.regions.get(key)
    if (existing) this.disposeRegion(existing)

    const maskData = new Uint8Array(32 * 32 * 4)
    // Mark any already-loaded hires chunks inside this region
    const baseCx = res.rx * 32
    const baseCz = res.rz * 32
    for (let lcz = 0; lcz < 32; lcz++) {
      for (let lcx = 0; lcx < 32; lcx++) {
        if (this.chunks.has(`${baseCx + lcx},${baseCz + lcz}`)) {
          maskData[(lcz * 32 + lcx) * 4] = 255
        }
      }
    }
    const maskTex = new THREE.DataTexture(maskData, 32, 32, THREE.RGBAFormat)
    maskTex.magFilter = THREE.NearestFilter
    maskTex.minFilter = THREE.NearestFilter
    maskTex.generateMipmaps = false
    maskTex.needsUpdate = true

    const terrainMat = new THREE.MeshLambertMaterial({ vertexColors: true })
    attachChunkMask(terrainMat, maskTex)
    const waterMat = new THREE.MeshLambertMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.78,
      depthWrite: false
    })
    attachChunkMask(waterMat, maskTex)

    const group = new THREE.Group()
    group.name = `r.${res.rx}.${res.rz}`
    const tGeo = buildGeometry(res.terrain)
    if (tGeo) {
      const m = new THREE.Mesh(tGeo, terrainMat)
      m.userData.isTerrain = true
      group.add(m)
    }
    const wGeo = buildGeometry(res.water)
    if (wGeo) {
      const m = new THREE.Mesh(wGeo, waterMat)
      m.renderOrder = 1
      group.add(m)
    }
    this.lowresGroup.add(group)
    this.regions.set(key, {
      key,
      rx: res.rx,
      rz: res.rz,
      group,
      terrainMat,
      waterMat,
      maskData,
      maskTex,
      surfaceY: res.surfaceY,
      grid: res.grid,
      step: res.step,
      lastUsed: this.tick
    })
    this.lastError = null
    this.onInvalidate()
  }

  private mountHires(key: string, res: HiresMeshResult): void {
    const existing = this.chunks.get(key)
    if (existing) this.disposeChunk(existing)

    const group = new THREE.Group()
    group.name = `c.${res.cx}.${res.cz}`
    for (let b = 0; b < res.buckets.length; b++) {
      const geo = buildGeometry(res.buckets[b])
      if (!geo) continue
      const mesh = new THREE.Mesh(geo, this.hiresMaterials[b])
      if (b === OPAQUE || b === CUTOUT || b === UNTEXTURED) mesh.userData.isTerrain = true
      if (b === LIQUID || b === TRANSLUCENT) mesh.renderOrder = 2
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
  }

  private setRegionMaskBit(cx: number, cz: number, value: number): void {
    const rx = cx >> 5
    const rz = cz >> 5
    const reg = this.regions.get(`${rx},${rz}`)
    if (!reg) return
    const lcx = cx & 31
    const lcz = cz & 31
    reg.maskData[(lcz * 32 + lcx) * 4] = value
    reg.maskTex.needsUpdate = true
  }

  private evictLru(targetX: number, targetZ: number): void {
    if (this.chunks.size > MAX_HIRES_CHUNKS) {
      const sorted = [...this.chunks.values()].sort((a, b) => {
        const da = Math.hypot((a.cx + 0.5) * 16 - targetX, (a.cz + 0.5) * 16 - targetZ)
        const db = Math.hypot((b.cx + 0.5) * 16 - targetX, (b.cz + 0.5) * 16 - targetZ)
        return db - da
      })
      for (const c of sorted.slice(0, this.chunks.size - MAX_HIRES_CHUNKS)) {
        this.chunks.delete(c.key)
        this.disposeChunk(c)
      }
    }
    if (this.regions.size > MAX_LOWRES_REGIONS) {
      const sorted = [...this.regions.values()].sort((a, b) => a.lastUsed - b.lastUsed)
      for (const r of sorted.slice(0, this.regions.size - MAX_LOWRES_REGIONS)) {
        this.regions.delete(r.key)
        this.disposeRegion(r)
      }
    }
  }

  private disposeRegion(r: RegionEntry): void {
    r.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose()
    })
    r.group.removeFromParent()
    r.terrainMat.dispose()
    r.waterMat.dispose()
    r.maskTex.dispose()
  }

  private disposeChunk(c: ChunkEntry): void {
    this.setRegionMaskBit(c.cx, c.cz, 0)
    c.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose()
    })
    c.group.removeFromParent()
  }

  private clearHires(): void {
    this.hiresGen++
    for (const ctrl of this.inflightHires.values()) ctrl.abort()
    this.inflightHires.clear()
    for (const c of this.chunks.values()) this.disposeChunk(c)
    this.chunks.clear()
  }

  private clearLowres(): void {
    for (const ctrl of this.inflightLowres.values()) ctrl.abort()
    this.inflightLowres.clear()
    for (const r of this.regions.values()) this.disposeRegion(r)
    this.regions.clear()
  }

  private abortAll(): void {
    for (const ctrl of this.inflightLowres.values()) ctrl.abort()
    for (const ctrl of this.inflightHires.values()) ctrl.abort()
    this.inflightLowres.clear()
    this.inflightHires.clear()
  }

  private emitStats(): void {
    const next: StreamStats = {
      lowresLoaded: this.regions.size,
      hiresLoaded: this.chunks.size,
      pending: this.inflightLowres.size + this.inflightHires.size,
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
    this.onStats?.(next)
  }

  dispose(): void {
    this.disposed = true
    this.abortAll()
    this.clearHires()
    this.clearLowres()
    this.hiresMaterials.forEach((m) => m.dispose())
    this.workers.forEach((w) => w.terminate())
    this.workers = []
    const err = new Error('WorldStreamer disposed')
    err.name = 'AbortError'
    for (const job of this.pendingJobs.values()) job.reject(err)
    this.pendingJobs.clear()
  }
}
