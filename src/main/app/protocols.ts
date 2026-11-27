// build://repo/<repo-relative path> serves workspace files; resource/cache mounts expose selected public files; mcpack://pack/ serves the jar-built pack.
// Nothing else on disk is reachable from the renderer.
import { existsSync } from 'fs'
import { join } from 'path'
import { net, protocol } from 'electron'
import { pathToFileURL } from 'url'
import { WorldDimensionSchema } from '@shared/api'
import { servedFile } from '../workspace/paths'
import createWorldWorker from '../world/world-worker?nodeWorker'
import { WorldWorkerPool } from '../world/world-worker-pool'
import { cacheDir, resolved } from './settings'
import { isMinecraftVersion } from '@shared/minecraft'
import { fileRevision } from './locations'

let worldPool: WorldWorkerPool | null = null

function getWorldPool(): WorldWorkerPool {
  if (!worldPool) {
    worldPool = new WorldWorkerPool({
      createWorker: () => createWorldWorker({})
    })
  }
  return worldPool
}

/** Terminate the background world reader worker threads on app exit. */
export function disposeWorldPool(): void {
  worldPool?.dispose()
  worldPool = null
}

const PRIVILEGES = {
  standard: true,
  secure: true,
  supportFetchAPI: true,
  stream: true,
  corsEnabled: true
}

/** Before app ready. */
export function registerSchemes(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: 'build', privileges: PRIVILEGES },
    { scheme: 'mcpack', privileges: PRIVILEGES },
    { scheme: 'world', privileges: PRIVILEGES }
  ])
}

async function serve(file: string | null): Promise<Response> {
  if (!file) return new Response('forbidden', { status: 403 })
  const res = await net.fetch(pathToFileURL(file).toString()).catch(() => null)
  if (!res?.ok) return new Response('not found', { status: 404 })
  const headers = new Headers(res.headers)
  headers.set('Access-Control-Allow-Origin', '*') // the dev renderer is on http://localhost
  headers.set('Cache-Control', 'no-cache') // builds rewrite out/ in place
  return new Response(res.body, { status: 200, headers })
}

const INT_PARAM_RE = /^-?\d+$/
const WORLD_VALID_TTL_MS = 10_000
const validWorldCache = new Map<string, number>()

function hasValidLevelDat(worldPath: string): boolean {
  const now = Date.now()
  const cachedUntil = validWorldCache.get(worldPath)
  if (cachedUntil !== undefined && now < cachedUntil) return true
  if (!existsSync(join(worldPath, 'level.dat'))) {
    validWorldCache.delete(worldPath)
    return false
  }
  validWorldCache.set(worldPath, now + WORLD_VALID_TTL_MS)
  return true
}

function toResponseBody(bytes: Uint8Array): BodyInit {
  if (
    bytes.buffer instanceof ArrayBuffer &&
    bytes.byteOffset === 0 &&
    bytes.byteLength === bytes.buffer.byteLength
  ) {
    return bytes.buffer
  }
  return new Uint8Array(bytes)
}

function parseIntParam(raw: string | null): number | null {
  if (raw === null || !INT_PARAM_RE.test(raw)) return null
  const n = Number(raw)
  return Number.isSafeInteger(n) ? n : null
}

/** After app ready. */
export function handleProtocols(): void {
  protocol.handle('build', (req) => {
    return serve(servedFile(req.url, resolved()))
  })
  protocol.handle('mcpack', (req) => {
    const url = new URL(req.url)
    const version = /^\/([\d.]+)\.zip$/.exec(url.pathname)?.[1]
    if (url.host !== 'pack') return serve(null)
    if (!version || !isMinecraftVersion(version)) return serve(null)
    const { pack } = resolved(undefined, version)
    if (!pack || fileRevision(pack) !== url.searchParams.get('v')) return serve(null)
    return serve(pack)
  })
  protocol.handle('world', async (req) => {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    }
    try {
      const url = new URL(req.url)
      if (url.host !== 'tile') return new Response('not found', { status: 404, headers: cors })
      const world = url.searchParams.get('world') ?? ''
      const dimRes = WorldDimensionSchema.safeParse(url.searchParams.get('dim') ?? 'overworld')
      if (!world || !dimRes.success || !hasValidLevelDat(world)) {
        return new Response('forbidden', { status: 403, headers: cors })
      }
      if (req.signal?.aborted) return new Response(null, { status: 499, headers: cors })
      const cache = cacheDir()
      if (url.pathname === '/lowres') {
        const rx = parseIntParam(url.searchParams.get('rx'))
        const rz = parseIntParam(url.searchParams.get('rz'))
        if (rx === null || rz === null) {
          return new Response('bad params', { status: 400, headers: cors })
        }
        const bytes = await getWorldPool().readLowres(world, dimRes.data, rx, rz, cache, req.signal)
        if (!bytes) return new Response(null, { status: 204, headers: cors })
        return new Response(toResponseBody(bytes), {
          status: 200,
          headers: { ...cors, 'Content-Type': 'application/octet-stream' }
        })
      }
      if (url.pathname === '/hires') {
        const cx = parseIntParam(url.searchParams.get('cx'))
        const cz = parseIntParam(url.searchParams.get('cz'))
        if (cx === null || cz === null) {
          return new Response('bad params', { status: 400, headers: cors })
        }
        const bytes = await getWorldPool().readHires(world, dimRes.data, cx, cz, cache, req.signal)
        if (!bytes) return new Response(null, { status: 204, headers: cors })
        return new Response(toResponseBody(bytes), {
          status: 200,
          headers: { ...cors, 'Content-Type': 'application/octet-stream' }
        })
      }
      return new Response('not found', { status: 404, headers: cors })
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return new Response(null, { status: 499, headers: cors })
      }
      console.error('[world://]', req.url, err)
      return new Response('error', { status: 500, headers: cors })
    }
  })
}
