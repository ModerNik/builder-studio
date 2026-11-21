// build://repo/<repo-relative path> serves workspace files; resource/cache mounts expose selected public files; mcpack://pack/ serves the jar-built pack.
// Nothing else on disk is reachable from the renderer.
import { net, protocol } from 'electron'
import { pathToFileURL } from 'url'
import { servedFile } from '../workspace/paths'
import { resolved } from './settings'
import { isMinecraftVersion } from '@shared/minecraft'
import { fileRevision } from './locations'

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
    { scheme: 'mcpack', privileges: PRIVILEGES }
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
}
