// Off-main-thread Node worker for Minecraft .mca region decompression, selective NBT parsing,
// and LOD-1 / LOD-0 binary tile extraction. Keeps Electron's main process completely responsive.
import { parentPort } from 'node:worker_threads'
import type { WorldDimension } from '@shared/api'
import { readHiresChunk, readLowresTile } from './world-reader'

export interface WorldWorkerRequest {
  id: number
  kind: 'lowres' | 'hires'
  worldPath: string
  dim: WorldDimension
  x: number
  z: number
  cacheRoot: string
}

export type WorldWorkerResponse =
  | { id: number; ok: true; buffer: ArrayBuffer | null }
  | { id: number; ok: false; message: string }

function toExactArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  if (
    bytes.buffer instanceof ArrayBuffer &&
    bytes.byteOffset === 0 &&
    bytes.byteLength === bytes.buffer.byteLength
  ) {
    return bytes.buffer
  }
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

if (parentPort) {
  const port = parentPort
  port.on('message', (req: WorldWorkerRequest) => {
    void (async () => {
      try {
        const bytes =
          req.kind === 'lowres'
            ? await readLowresTile(req.worldPath, req.dim, req.x, req.z, req.cacheRoot)
            : await readHiresChunk(req.worldPath, req.dim, req.x, req.z, req.cacheRoot)
        if (!bytes) {
          port.postMessage({ id: req.id, ok: true, buffer: null } satisfies WorldWorkerResponse)
          return
        }
        const buffer = toExactArrayBuffer(bytes)
        port.postMessage({ id: req.id, ok: true, buffer } satisfies WorldWorkerResponse, [buffer])
      } catch (err) {
        port.postMessage({
          id: req.id,
          ok: false,
          message: err instanceof Error ? err.message : String(err)
        } satisfies WorldWorkerResponse)
      }
    })()
  })
}
