// Opt-in acceptance of actual assembled artifacts. Uses isolated settings and workspace only.
import { createServer } from 'http'
import { createReadStream } from 'fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { join, resolve } from 'path'
import { tmpdir } from 'os'
import { expect, it } from 'vitest'
import { SettingsSchema } from '@shared/api'
import { resolveLocations } from '../app/locations'
import {
  command,
  diagnose,
  downloadArtifact,
  extract,
  RuntimeManifest,
  RuntimeService
} from './runtime'

it.skipIf(process.env.BS_RUNTIME_CHECK !== '1')(
  'activates, repairs and rolls back real artifacts and preserves settings/workspace on failures',
  async () => {
    const root = process.env.BS_ACCEPTANCE_ROOT
      ? resolve(process.env.BS_ACCEPTANCE_ROOT)
      : await mkdtemp(join(tmpdir(), 'studio portable сборка '))
    if (process.env.BS_ACCEPTANCE_ROOT) await mkdir(root)
    const defaults = {
      runtime: join(root, 'managed/current'),
      // the source of the packaged copy (check-package proves them byte-identical), so it can run while packaging
      resources: resolve('out/runtime/engine/resources'),
      cache: join(root, 'cache'),
      claude: ''
    }
    const manifest = RuntimeManifest.parse(
      JSON.parse(await readFile('out/runtime/runtime-manifest.json', 'utf8'))
    )
    const workspace = join(root, 'workspace проекты')
    await mkdir(workspace)
    const protectedFile = join(workspace, 'existing export.litematic')
    await writeFile(protectedFile, 'existing user bytes')
    let s = SettingsSchema.parse({
      workspace,
      python: '',
      jar: '',
      schematics: join(root, 'exports'),
      pack: '',
      claude: ''
    })
    let failure = ''
    let cancelDownload: (() => void) | undefined
    const server = createServer((req, res) => {
      const info = [manifest.engine, manifest.git].find((a) => `/${a.asset}` === req.url)
      if (!info || failure === 'http') return void res.writeHead(503).end()
      if (failure === 'cancel') {
        res.write(Buffer.from('partial'))
        cancelDownload?.()
        return
      }
      createReadStream(join('out/runtime', info.asset)).pipe(res)
    })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    const addr = server.address()
    if (!addr || typeof addr === 'string') throw new Error('No test HTTP port')
    const service = new RuntimeService({
      settings: () => resolveLocations(s, defaults),
      save: (next) => {
        s = next
      },
      idle: () => {},
      home: () => join(root, 'managed'),
      extractScript: resolve('runtime/extract.ps1'),
      appVersion: manifest.appVersion,
      manifest: async () =>
        failure === 'app-version' ? { ...manifest, appVersion: 'incompatible' } : manifest,
      emit: () => {},
      asset: (info, target, signal, progress) =>
        downloadArtifact(
          `http://127.0.0.1:${addr.port}/${info.asset}`,
          failure === 'checksum' ? { ...info, sha256: '0'.repeat(64) } : info,
          target,
          signal,
          progress
        ),
      unpack: async (...args) => {
        await extract(...args)
        const target = args[1]
        if (failure === 'receipt') await writeFile(join(target, 'runtime.json'), '{}')
        if (failure === 'incomplete')
          await rm(join(target, 'Lib/site-packages/mcb'), { recursive: true })
        if (failure === 'smoke')
          await writeFile(
            join(target, 'Lib/site-packages/mcb/__init__.py'),
            'raise RuntimeError("failed smoke")'
          )
        if (failure === 'engine-version') {
          const receipt = JSON.parse(await readFile(join(target, 'runtime.json'), 'utf8'))
          receipt.engine.source.commit = '0'.repeat(40)
          await writeFile(join(target, 'runtime.json'), JSON.stringify(receipt))
        }
      }
    })
    try {
      await service.install('engine')
      const first = s.runtime
      expect((await diagnose(resolveLocations(s, defaults))).engine).toMatchObject({ ok: true })
      await service.install('engine')
      expect(s.previousRuntime).toBe(first)
      await service.install('rollback')
      expect(s.runtime).toBe(first)
      const before = JSON.stringify(s)
      for (failure of [
        'http',
        'checksum',
        'receipt',
        'incomplete',
        'smoke',
        'engine-version',
        'app-version',
        'cancel'
      ]) {
        cancelDownload = () => service.cancel()
        await expect(service.install('engine')).rejects.toThrow()
        expect(JSON.stringify(s), failure).toBe(before)
        expect(await readFile(protectedFile, 'utf8'), failure).toBe('existing user bytes')
        expect((await diagnose(resolveLocations(s, defaults))).engine.ok, failure).toBe(true)
      }
      failure = ''
      await service.install('git')
      expect(await command(s.git, ['--version'])).toContain('2.56.0')
      await command(s.git, ['init', '-q'], { cwd: workspace })
      if (process.env.BS_BROWSER_CHECK === '1') {
        await service.install('browser')
        expect(s.browser).toContain(root)
        expect((await diagnose(resolveLocations(s, defaults))).browser).toMatchObject({ ok: true })
      }
      await writeFile(
        join(root, 'settings.json'),
        JSON.stringify(resolveLocations(s, defaults), null, 2)
      )
      expect(service.state).toMatchObject({ busy: false, stage: 'ready' })
    } finally {
      service.cancel()
      server.closeAllConnections()
      await new Promise<void>((r, reject) => server.close((e) => (e ? reject(e) : r())))
      if (!process.env.BS_ACCEPTANCE_ROOT) await rm(root, { recursive: true, force: true })
    }
  },
  600000
)
