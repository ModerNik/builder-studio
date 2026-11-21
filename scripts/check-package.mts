// Run after npm run build:win; inspect local artifacts without launching or publishing them.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import yaml from 'js-yaml'
import { FileMatcher } from 'app-builder-lib/out/fileMatcher.js'
import asar from '@electron/asar'
import fuses from '@electron/fuses'

const root = path.resolve(import.meta.dirname, '..')
const config = yaml.load(fs.readFileSync(path.join(root, 'electron-builder.yml'), 'utf8')) as {
  files: string[]
  extraResources: { from: string; to: string; filter?: string[] }[]
}
const filter = new FileMatcher(root, '', (p) => p, config.files).createFilter()
const fileStat = fs.statSync(path.join(root, 'package.json'))
for (const file of [
  'src/main/index.ts',
  'engine/.venv/Scripts/python.exe',
  'out/runtime/runtime-manifest.json',
  'out/codex-protocol/v2/Thread.ts',
  'out/acceptance/profile/providers/codex/auth.json'
])
  assert.equal(filter(path.join(root, file), fileStat), false, `Unsafe package input: ${file}`)
for (const file of [
  'out/main/index.js',
  'out/preload/index.js',
  'out/renderer/index.html',
  'resources/icon.png',
  'package.json'
])
  assert.equal(filter(path.join(root, file), fileStat), true, `Missing application input: ${file}`)

const packaged = path.resolve(root, process.env.BS_PACKAGE_ROOT || 'dist/win-unpacked')
const resources = path.join(packaged, 'resources')
const fuseWire = await fuses.getCurrentFuseWire(path.join(packaged, 'builder-studio.exe'))
for (const [option, enabled] of [
  [fuses.FuseV1Options.RunAsNode, false],
  [fuses.FuseV1Options.EnableNodeOptionsEnvironmentVariable, false],
  [fuses.FuseV1Options.EnableNodeCliInspectArguments, false],
  [fuses.FuseV1Options.EnableEmbeddedAsarIntegrityValidation, true],
  [fuses.FuseV1Options.OnlyLoadAppFromAsar, true]
] as const)
  // Fuse wire encodes disabled/enabled as ASCII 0/1.
  assert.equal(fuseWire[option], enabled ? 49 : 48, `Electron fuse: ${option}`)
// The app runs the user's own Claude Code, so Anthropic's binary is not redistributed at all.
assert(
  !fs.existsSync(path.join(resources, 'app.asar.unpacked/node_modules/@anthropic-ai')),
  'The Agent SDK platform binary must not be packaged'
)
assert.deepEqual(fs.readdirSync(path.join(packaged, 'locales')), ['en-US.pak'], 'Chromium locales')
const entries = asar
  .listPackage(path.join(resources, 'app.asar'))
  .map((p) => p.replaceAll('\\', '/'))
for (const entry of entries) {
  assert.doesNotMatch(entry, /claude-agent-sdk-[^/]+\//, `Agent SDK platform file: ${entry}`)
  assert.match(
    entry,
    /^\/(node_modules|resources|out(?:\/(main|preload|renderer))?|package\.json)(\/|$)/,
    `Unexpected ASAR entry: ${entry}`
  )
}
for (const file of [
  '/out/main/index.js',
  '/out/preload/index.js',
  '/out/renderer/index.html',
  '/package.json'
])
  assert(entries.includes(file), `Missing ASAR entry: ${file}`)

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name)
    return entry.isDirectory() ? files(file) : [file]
  })
}
let resourceCount = 0
for (const mapping of config.extraResources) {
  const source = path.join(root, mapping.from)
  const target = path.join(resources, mapping.to)
  if (fs.statSync(source).isFile()) {
    assert.deepEqual(fs.readFileSync(target), fs.readFileSync(source), mapping.to)
    resourceCount++
    continue
  }
  const expected = fs
    .globSync(mapping.filter ?? ['**/*', '.*/**/*'], { cwd: source })
    .map((file) => path.join(source, file))
    .filter((file) => fs.statSync(file).isFile())
  const relative = (base: string, list: string[]): string[] =>
    list.map((file) => path.relative(base, file)).sort()
  assert.deepEqual(
    relative(target, files(target)),
    relative(source, expected),
    `Resource inventory: ${mapping.to}`
  )
  for (const file of expected)
    assert.deepEqual(
      fs.readFileSync(path.join(target, path.relative(source, file))),
      fs.readFileSync(file),
      file
    )
  resourceCount += expected.length
}
assert(!fs.existsSync(path.join(root, 'engine')), 'Embedded engine checkout must be removed')
const pin = JSON.parse(fs.readFileSync(path.join(root, 'runtime/engine.json'), 'utf8'))
const engineManifestBytes = fs.readFileSync(
  path.join(resources, 'engine-provenance/engine-manifest.json')
)
const engineManifest = JSON.parse(engineManifestBytes.toString('utf8'))
assert.equal(engineManifest.source.commit, pin.source.commit)
assert.equal(engineManifest.source.tree, pin.source.tree)
assert.equal(engineManifest.distribution, 'binary')
assert.equal(engineManifest.protection.mode, 'native')
assert(
  pin.inputs.some(
    (input: { manifestSha256: string }) =>
      input.manifestSha256 === createHash('sha256').update(engineManifestBytes).digest('hex')
  )
)
for (const [file, record] of Object.entries(engineManifest.files) as [
  string,
  { bytes: number; sha256: string }
][]) {
  if (!file.startsWith('resources/')) continue
  const data = fs.readFileSync(path.join(resources, 'engine', file.slice('resources/'.length)))
  assert.equal(data.length, record.bytes, file)
  assert.equal(createHash('sha256').update(data).digest('hex'), record.sha256, file)
}
for (const file of [
  'AGENTS.md',
  'CLAUDE.md',
  'docs/pipeline.md',
  'lib/mcb/data/block_colors.json',
  'tools/render/viewer.html'
])
  assert(fs.existsSync(path.join(resources, 'engine', file)), file)
for (const file of ['bs-renderer.js', 'LICENSES.txt', 'SOURCE.zip'])
  assert(fs.existsSync(path.join(resources, 'engine/tools/render/vendor/bs-renderer', file)), file)
for (const file of files(path.join(resources, 'engine')))
  assert(
    !/schematic-renderer|nucleation|litemapy/i.test(file),
    `Obsolete runtime resource: ${file}`
  )
for (const [destination, module] of Object.entries(engineManifest.protection.modules) as [
  string,
  { extension: string; loader: string | null }
][]) {
  assert(engineManifest.files[`runtime/Lib/site-packages/${module.extension}`], destination)
  assert(
    !engineManifest.files[`runtime/Lib/site-packages/${destination}`] || module.loader,
    destination
  )
  const resource = path.join(resources, 'engine', destination)
  if (fs.existsSync(resource)) {
    assert(module.loader, `Plaintext proprietary resource: ${destination}`)
    assert.equal(fs.readFileSync(resource, 'utf8'), module.loader, destination)
  }
}
for (const file of [
  'legal/ENGINE-EULA.md',
  'legal/THIRD_PARTY_NOTICES.md',
  'legal/GEOS-SOURCES.md'
])
  assert(fs.existsSync(path.join(resources, 'engine', file)), file)
// Official public builds must never contain embedded GitHub credentials or update tokens.
const builtMain = asar
  .extractFile(path.join(resources, 'app.asar'), path.join('out', 'main', 'index.js'))
  .toString('utf8')
assert(
  !/MAIN_VITE_BS_UPDATE_TOKEN|github_pat_|gh[pousr]_[A-Za-z0-9]{20,}/.test(builtMain),
  'Embedded repository credential'
)
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, 'out/runtime/runtime-manifest.json'), 'utf8')
)
assert.equal(
  manifest.appVersion,
  JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version
)
const delivery = JSON.parse(
  fs.readFileSync(path.join(resources, 'runtime-delivery/delivery.json'), 'utf8')
)
assert(['bundled', 'download'].includes(delivery.mode), 'Unknown delivery mode')
assert.deepEqual(
  JSON.parse(
    fs.readFileSync(path.join(resources, 'runtime-delivery/runtime-manifest.json'), 'utf8')
  ),
  manifest
)
assert.deepEqual(
  fs.readdirSync(path.join(resources, 'runtime-delivery')).sort(),
  [
    'delivery.json',
    'runtime-manifest.json',
    ...(delivery.mode === 'bundled' ? [manifest.engine.asset, manifest.git.asset] : [])
  ].sort()
)
for (const artifact of [manifest.engine, manifest.git]) {
  const data = fs.readFileSync(path.join(root, 'out/runtime', artifact.asset))
  assert.equal(data.length, artifact.bytes, artifact.asset)
  assert.equal(createHash('sha256').update(data).digest('hex'), artifact.sha256, artifact.asset)
}
for (const entry of entries.filter((name) => /^\/out\/.*\.(js|html|json)$/.test(name))) {
  const data = asar
    .extractFile(path.join(resources, 'app.asar'), path.normalize(entry.slice(1)))
    .toString('utf8')
  assert(
    !/github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,}/.test(data),
    `Credential in ${entry}`
  )
}
const updateConfig = fs.readFileSync(path.join(resources, 'app-update.yml'), 'utf8')
assert(
  !/token\s*:|Authorization\s*:|github_pat_|gh[pousr]_[A-Za-z0-9]{20,}/i.test(updateConfig),
  'Credential in updater configuration'
)
console.log(
  JSON.stringify({
    asarEntries: entries.length,
    resourceFiles: resourceCount,
    runtimeArtifactsVerified: 2,
    delivery: delivery.mode
  })
)
