// Stage only the files this installer delivers; CI credentials never enter this directory.
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export function bundleTools(value = ''): boolean {
  if (value === '' || value === 'false') return false
  if (value === 'true') return true
  throw new Error('BS_BUNDLE_ENGINE must be true, false, or unset')
}

export function prepareDelivery(root: string, value = ''): void {
  const bundled = bundleTools(value)
  const runtime = path.join(root, 'out/runtime')
  const manifest = JSON.parse(fs.readFileSync(path.join(runtime, 'runtime-manifest.json'), 'utf8'))
  const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version
  if (manifest.appVersion !== version) throw new Error('Rebuild the runtime for this app version')
  const output = path.join(runtime, 'delivery')
  fs.mkdirSync(output, { recursive: true })
  // The staging directory is task-owned; reject unexpected entries rather than deleting them.
  for (const name of fs.readdirSync(output)) {
    if (!/^(delivery\.json|runtime-manifest\.json|builder-[\w.-]+\.zip)$/.test(name))
      throw new Error(`Unexpected delivery staging file: ${name}`)
    fs.unlinkSync(path.join(output, name))
  }
  for (const info of [manifest.engine, manifest.git]) {
    if (!/^builder-[\w.-]+\.zip$/.test(info.asset)) throw new Error('Invalid runtime archive name')
    const bytes = fs.readFileSync(path.join(runtime, info.asset))
    if (
      bytes.length !== info.bytes ||
      createHash('sha256').update(bytes).digest('hex') !== info.sha256
    )
      throw new Error(`Runtime integrity check failed: ${info.asset}`)
    if (bundled) fs.copyFileSync(path.join(runtime, info.asset), path.join(output, info.asset))
  }
  fs.copyFileSync(
    path.join(runtime, 'runtime-manifest.json'),
    path.join(output, 'runtime-manifest.json')
  )
  fs.writeFileSync(
    path.join(output, 'delivery.json'),
    JSON.stringify({ mode: bundled ? 'bundled' : 'download' }) + '\n'
  )
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  prepareDelivery(path.resolve(import.meta.dirname, '..'), process.env.BS_BUNDLE_ENGINE)
