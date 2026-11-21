import { createHash } from 'crypto'
import { existsSync } from 'fs'
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { basename, join, resolve } from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SettingsSchema, type Settings } from '@shared/api'
import runtimeSources from '../../../runtime/sources.json'
import {
  command,
  downloadArtifact,
  extract,
  installedGit,
  packagedSource,
  releaseSource,
  RuntimeService,
  type Manifest
} from './runtime'

vi.mock('../../../runtime/sources.json', async () => ({
  default: {
    git: {
      version: '2.0',
      url: 'https://example.test/MinGit.zip',
      sha256: (await import('node:crypto'))
        .createHash('sha256')
        .update('portable git')
        .digest('hex')
    }
  }
}))

const roots: string[] = []
afterEach(async () => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  for (const path of roots.splice(0)) await rm(path, { recursive: true, force: true })
})
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- retain inferred mock signatures for failure injection
async function setup() {
  const root = await mkdtemp(join(tmpdir(), 'studio runtime среда '))
  roots.push(root)
  const home = join(root, 'managed')
  const old = join(home, 'old')
  await mkdir(old, { recursive: true })
  await writeFile(join(old, 'python.exe'), 'previous working version')
  let saved: Settings = SettingsSchema.parse({
    workspace: root,
    runtime: old,
    runtimeHome: home,
    cache: join(root, 'cache'),
    python: '',
    pack: '',
    jar: '',
    claude: '',
    schematics: ''
  })
  const artifact = { version: 'test-1', asset: 'test.zip', bytes: 5, sha256: 'a'.repeat(64) }
  const manifest: Manifest = {
    schema: 1,
    appVersion: '1.0.3',
    platform: 'win32-x64',
    engine: artifact,
    git: artifact
  }
  const deps = {
    settings: () => ({ ...saved, python: saved.python || join(saved.runtime, 'python.exe') }),
    save: vi.fn((s: Settings) => {
      saved = s
    }),
    idle: vi.fn(),
    home: () => home,
    extractScript: '',
    appVersion: '1.0.3',
    manifest: vi.fn(async () => manifest),
    asset: vi.fn(async (_info, path: string, _signal: AbortSignal) => {
      _signal.throwIfAborted()
      await writeFile(path, 'bytes')
    }),
    unpack: vi.fn(async (_archive, path: string) => {
      await writeFile(
        join(path, 'runtime.json'),
        JSON.stringify({ version: 'test-1', appVersion: '1.0.3' })
      )
      await writeFile(join(path, 'python.exe'), 'new working version')
    }),
    validate: vi.fn(async () => {}),
    emit: vi.fn()
  }
  return {
    root,
    home,
    old,
    deps,
    get saved() {
      return saved
    },
    service: new RuntimeService(deps)
  }
}

describe('runtime activation', () => {
  it('activates only after validation, repairs into a new directory and rolls back without deleting either version', async () => {
    const f = await setup()
    f.deps.validate.mockImplementationOnce(async () => {
      expect(f.saved.runtime).toBe(f.old)
    })
    await f.service.install('engine')
    const first = f.saved.runtime
    expect(first).not.toBe(f.old)
    expect(f.saved.previousRuntime).toBe(f.old)
    await f.service.install('engine')
    const second = f.saved.runtime
    expect(second).not.toBe(first)
    expect(f.saved.previousRuntime).toBe(first)
    await f.service.install('rollback')
    expect(f.saved.runtime).toBe(first)
    expect(f.saved.previousRuntime).toBe(second)
    expect(await readFile(join(f.old, 'python.exe'), 'utf8')).toBe('previous working version')
    expect(await readdir(join(f.saved.cache, 'downloads'))).toEqual([])
    expect(f.service.state.busy).toBe(false)
  })

  it.each(['download', 'extract', 'validate', 'save', 'manifest'] as const)(
    'preserves the working version and cleans only its own staging on %s failure',
    async (failure) => {
      const f = await setup()
      const fn = {
        download: f.deps.asset,
        extract: f.deps.unpack,
        validate: f.deps.validate,
        save: f.deps.save,
        manifest: f.deps.manifest
      }[failure]
      fn.mockImplementationOnce(() => {
        throw new Error(`failed ${failure}`)
      })
      await expect(f.service.install('engine')).rejects.toThrow(`failed ${failure}`)
      expect(f.saved.runtime).toBe(f.old)
      expect(await readdir(f.home)).toEqual(['old'])
      expect(await readdir(join(f.saved.cache, 'downloads'))).toEqual([])
      expect(f.service.state).toMatchObject({ busy: false, stage: 'failed' })
      await f.service.install('engine') // retry after failure
      expect(f.saved.previousRuntime).toBe(f.old)
    }
  )

  it('cancels an interrupted download, rejects concurrent installs and retries safely', async () => {
    const f = await setup()
    let downloading!: () => void
    const started = new Promise<void>((r) => {
      downloading = r
    })
    f.deps.asset.mockImplementationOnce(async (_info, path: string, signal: AbortSignal) => {
      await writeFile(path, 'partial')
      downloading()
      await new Promise<void>((_resolve, reject) =>
        signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
      )
    })
    const install = f.service.install('engine')
    const rejected = expect(install).rejects.toThrow('aborted')
    await started
    await expect(f.service.install('engine')).rejects.toThrow('already running')
    f.service.cancel()
    await rejected
    expect(f.saved.runtime).toBe(f.old)
    expect(await readdir(f.home)).toEqual(['old'])
    expect(f.service.state.stage).toBe('cancelled')
    await f.service.install('engine')
  })

  it('refuses activation while services are active and rejects app-version mismatches', async () => {
    const f = await setup()
    f.deps.idle.mockImplementationOnce(() => {
      throw new Error('active jobs')
    })
    await expect(f.service.install('engine')).rejects.toThrow('active jobs')
    expect(f.deps.asset).not.toHaveBeenCalled()
    f.deps.manifest.mockResolvedValueOnce({ ...(await f.deps.manifest()), appVersion: 'other' })
    await expect(f.service.install('engine')).rejects.toThrow('does not match')
    expect(f.saved.runtime).toBe(f.old)
    f.deps.idle
      .mockImplementationOnce(() => {})
      .mockImplementationOnce(() => {
        throw new Error('new session')
      })
    await expect(f.service.install('engine')).rejects.toThrow('new session')
    expect(f.saved.runtime).toBe(f.old)
    expect(await readdir(f.home)).toEqual(['old'])
  })

  it('deletes superseded engines and keeps only the active and fallback versions', async () => {
    const f = await setup()
    await f.service.install('engine')
    const first = f.saved.runtime
    await f.service.install('engine')
    await f.service.install('engine')
    expect((await readdir(f.home)).sort()).toEqual(
      ['old', basename(f.saved.runtime), basename(f.saved.previousRuntime)].sort()
    )
    expect(existsSync(first)).toBe(false)
  })

  it('rejects rollback when its smoke check fails', async () => {
    const f = await setup()
    await f.service.install('engine')
    const active = f.saved.runtime
    f.deps.validate.mockRejectedValueOnce(new Error('broken previous version'))
    await expect(f.service.install('rollback')).rejects.toThrow('broken previous')
    expect(f.saved.runtime).toBe(active)
    expect(f.saved.previousRuntime).toBe(f.old)
  })

  it('retains the known working fallback when repairing a broken current runtime', async () => {
    const f = await setup()
    await f.service.install('engine')
    f.deps.validate
      .mockImplementationOnce(async () => {})
      .mockRejectedValueOnce(new Error('current runtime is damaged'))
    await f.service.install('engine')
    expect(f.saved.previousRuntime).toBe(f.old)
  })
})

describe('download integrity', () => {
  it('uses the exact public app release and API asset URLs without credentials', async () => {
    const f = await setup()
    const manifest = await f.deps.manifest()
    const content = Buffer.from('runtime archive')
    manifest.engine = {
      ...manifest.engine,
      bytes: content.length,
      sha256: createHash('sha256').update(content).digest('hex')
    }
    const request = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          assets: [
            { name: 'runtime-manifest.json', url: 'https://api.github.com/manifest' },
            { name: manifest.engine.asset, url: 'https://api.github.com/archive' }
          ]
        })
      )
      .mockResolvedValueOnce(Response.json(manifest))
      .mockResolvedValueOnce(new Response(content))
    const source = releaseSource('1.0.3', request)
    const signal = new AbortController().signal
    const info = await source.manifest(signal)
    await source.asset(info.engine, join(f.root, 'api.zip'), signal, vi.fn())
    expect(request.mock.calls[0][0]).toContain('/releases/tags/v1.0.3')
    expect(request.mock.calls[1][1].headers).toMatchObject({
      Accept: 'application/octet-stream'
    })
    for (const [, options] of request.mock.calls)
      expect(new Headers(options.headers).has('Authorization')).toBe(false)
    expect(request.mock.calls[2][0]).toBe('https://api.github.com/archive')
    expect(await readFile(join(f.root, 'api.zip'))).toEqual(content)
  })

  it('downloads only the pinned upstream Portable Git and rejects a substituted pin', async () => {
    const f = await setup()
    const content = Buffer.from('portable git')
    const info = { ...runtimeSources.git, asset: 'builder-git-win-x64.zip', bytes: content.length }
    const request = vi.fn<typeof fetch>(async () => new Response(content))
    const source = releaseSource('1.1.1', request)
    const target = join(f.root, 'git.zip')
    const signal = new AbortController().signal
    await source.asset(info, target, signal, vi.fn())
    expect(request.mock.calls[0][0]).toBe(runtimeSources.git.url)
    expect(new Headers(request.mock.calls[0][1]?.headers).has('Authorization')).toBe(false)
    expect(await readFile(target)).toEqual(content)
    for (const changed of [{ version: 'substitute' }, { sha256: '0'.repeat(64) }])
      await expect(source.asset({ ...info, ...changed }, target, signal, vi.fn())).rejects.toThrow(
        'approved upstream'
      )
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('reports releases without runtime assets and HTTP failures for retry', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(Response.json({ assets: [] }))
    const source = releaseSource('1.0.3', request)
    const signal = new AbortController().signal
    await expect(source.manifest(signal)).rejects.toThrow('HTTP 404')
    await expect(source.manifest(signal)).rejects.toThrow('no managed runtime')
  })
  it('stops a partial streaming download on cancellation', async () => {
    const f = await setup()
    const controller = new AbortController()
    const body = new ReadableStream({
      start(stream) {
        stream.enqueue(new Uint8Array([1, 2]))
      }
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(body))
    )
    await expect(
      downloadArtifact(
        'https://example.test/runtime',
        {
          version: '1',
          asset: 'r.zip',
          bytes: 10,
          sha256: '0'.repeat(64)
        },
        join(f.root, 'partial.zip'),
        controller.signal,
        () => controller.abort()
      )
    ).rejects.toThrow(/abort/i)
  })
  it('verifies digest and exact byte count and rejects checksum, truncated and oversized downloads', async () => {
    const f = await setup()
    const content = Buffer.from('runtime archive')
    const spec = {
      version: '1',
      asset: 'r.zip',
      bytes: content.length,
      sha256: createHash('sha256').update(content).digest('hex')
    }
    const progress = vi.fn()
    for (const [name, data, info, error] of [
      ['valid', content, spec, null],
      ['checksum', content, { ...spec, sha256: '0'.repeat(64) }, /checksum/],
      ['truncated', content.subarray(0, 2), spec, /size mismatch/],
      ['oversized', Buffer.concat([content, content]), spec, /exceeds/]
    ] as const) {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response(data))
      )
      const download = downloadArtifact(
        'https://example.test/runtime',
        info,
        join(f.root, `${name}.zip`),
        new AbortController().signal,
        progress
      )
      if (error) await expect(download).rejects.toThrow(error)
      else await download
    }
    expect(progress).toHaveBeenCalledWith(content.length, content.length)
  })
})

it('prefers installed Git and falls back to managed Git without changing global PATH', async () => {
  const f = await setup()
  const systemGit = join(f.root, process.platform === 'win32' ? 'git.exe' : 'git')
  await writeFile(systemGit, 'installed')
  vi.stubEnv('PATH', f.root)
  expect(installedGit(join(f.old, 'python.exe'))).toBe(systemGit)
  vi.stubEnv('PATH', '')
  expect(installedGit(join(f.old, 'python.exe'))).toBe(join(f.old, 'python.exe'))
  expect(installedGit(join(f.root, 'absent'))).toBe('')
})

it('terminates timed-out subprocesses and reports cancellation', async () => {
  await expect(
    command(process.execPath, ['-e', 'setInterval(()=>{}, 1000)'], { timeout: 50 })
  ).rejects.toThrow('timed out')
  const controller = new AbortController()
  const run = command(process.execPath, ['-e', 'setInterval(()=>{}, 1000)'], {
    signal: controller.signal
  })
  const result = expect(run).rejects.toThrow('cancelled')
  controller.abort()
  await result
})

describe.skipIf(process.platform !== 'win32')('Windows archive extraction', () => {
  it('extracts ordinary paths and rejects traversal, ADS, links, reserved names and case collisions before writing', async () => {
    const f = await setup()
    const fixtures = [
      ['valid', ['folder/file.txt']],
      ['parent', ['safe.txt', '../escape.txt']],
      ['absolute', ['/escape.txt']],
      ['drive', ['C:/escape.txt']],
      ['ads', ['file:stream']],
      ['symlink', ['link']],
      ['reserved', ['NUL.txt']],
      ['duplicate', ['a.txt', 'A.txt']],
      ['trailing', ['folder./file.txt']],
      ['backslash', ['..\\escape.txt']]
    ]
    await command(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        'Add-Type -AssemblyName System.IO.Compression.FileSystem; ' +
          'foreach($f in (ConvertFrom-Json $env:ZIP_FIXTURES)) { ' +
          '$z=[IO.Compression.ZipFile]::Open((Join-Path $env:ZIP_ROOT ($f[0]+".zip")),"Create"); ' +
          'foreach($n in $f[1]) { $e=$z.CreateEntry($n); if($f[0] -eq "symlink") {$e.ExternalAttributes=-1577123840}; ' +
          '$s=[IO.StreamWriter]::new($e.Open()); $s.Write("content"); $s.Dispose() }; $z.Dispose() }'
      ],
      { env: { ...process.env, ZIP_ROOT: f.root, ZIP_FIXTURES: JSON.stringify(fixtures) } }
    )
    for (const [name] of fixtures) {
      const target = join(f.root, String(name))
      await mkdir(target)
      const run = extract(join(f.root, `${name}.zip`), target, resolve('runtime/extract.ps1'))
      if (name === 'valid') {
        await run
        expect(await readFile(join(target, 'folder/file.txt'), 'utf8')).toBe('content')
      } else {
        await expect(run).rejects.toThrow(/Unsafe archive/)
        expect(await readdir(target)).toEqual([])
      }
    }
  }, 60000)
})

describe('installer delivery', () => {
  it('verifies included archives offline and never falls back to the network on corruption', async () => {
    const f = await setup()
    const content = Buffer.from('bundled engine')
    const info = {
      version: '1',
      asset: 'builder-runtime-test.zip',
      bytes: content.length,
      sha256: createHash('sha256').update(content).digest('hex')
    }
    const manifest = { ...(await f.deps.manifest()), engine: info }
    await writeFile(join(f.root, 'runtime-manifest.json'), JSON.stringify(manifest))
    await writeFile(join(f.root, 'delivery.json'), JSON.stringify({ mode: 'bundled' }))
    await writeFile(join(f.root, info.asset), content)
    const request = vi.fn<typeof fetch>()
    const source = packagedSource(f.root, manifest.appVersion, request)
    const signal = new AbortController().signal
    expect(await source.manifest(signal)).toEqual(manifest)
    await source.asset(info, join(f.root, 'copied.zip'), signal, vi.fn())
    expect(await readFile(join(f.root, 'copied.zip'))).toEqual(content)
    await writeFile(join(f.root, info.asset), Buffer.alloc(content.length))
    await expect(source.asset(info, join(f.root, 'corrupt.zip'), signal, vi.fn())).rejects.toThrow(
      'checksum'
    )
    await rm(join(f.root, info.asset))
    await expect(source.asset(info, join(f.root, 'missing.zip'), signal, vi.fn())).rejects.toThrow()
    expect(request).not.toHaveBeenCalled()
    await expect(packagedSource(f.root, 'wrong').manifest(signal)).rejects.toThrow('match')
  })

  it('uses the installer pin for anonymous downloads and explains inaccessible releases', async () => {
    const f = await setup()
    const content = Buffer.from('downloaded engine')
    const info = {
      version: '1',
      asset: 'builder-runtime-test.zip',
      bytes: content.length,
      sha256: createHash('sha256').update(content).digest('hex')
    }
    const manifest = { ...(await f.deps.manifest()), engine: info }
    await writeFile(join(f.root, 'delivery.json'), JSON.stringify({ mode: 'download' }))
    await writeFile(join(f.root, 'runtime-manifest.json'), JSON.stringify(manifest))
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          assets: [
            { name: 'runtime-manifest.json', url: 'https://example.test/manifest' },
            { name: info.asset, url: 'https://example.test/engine' }
          ]
        })
      )
      .mockResolvedValueOnce(Response.json(manifest))
      .mockResolvedValueOnce(new Response(content))
      .mockResolvedValueOnce(new Response('', { status: 404 }))
    const source = packagedSource(f.root, manifest.appVersion, request)
    const signal = new AbortController().signal
    await source.asset(info, join(f.root, 'downloaded.zip'), signal, vi.fn())
    expect(await readFile(join(f.root, 'downloaded.zip'))).toEqual(content)
    await expect(source.asset(info, join(f.root, 'retry.zip'), signal, vi.fn())).rejects.toThrow(
      'private or unpublished'
    )
    for (const [, options] of request.mock.calls)
      expect(new Headers(options?.headers).has('Authorization')).toBe(false)
    request
      .mockResolvedValueOnce(
        Response.json({
          assets: [{ name: 'runtime-manifest.json', url: 'https://example.test/manifest' }]
        })
      )
      .mockResolvedValueOnce(
        Response.json({ ...manifest, engine: { ...info, sha256: '0'.repeat(64) } })
      )
    await expect(
      source.asset(info, join(f.root, 'substitute.zip'), signal, vi.fn())
    ).rejects.toThrow('does not match')
  })
})
