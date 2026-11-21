// Immutable runtime directories: settings switch only after the candidate passes validation.
import { execFile } from 'child_process'
import { createHash, randomUUID } from 'crypto'
import { createReadStream, createWriteStream, existsSync } from 'fs'
import { mkdir, mkdtemp, readdir, readFile, rename, rm } from 'fs/promises'
import { join, delimiter, isAbsolute, resolve } from 'path'
import { Readable, Transform } from 'stream'
import { pipeline } from 'stream/promises'
import { z } from 'zod'
import type {
  RuntimeAction,
  RuntimeDelivery,
  RuntimeDiagnostics,
  RuntimeState,
  Settings
} from '@shared/api'
import { DEFAULT_MINECRAFT_VERSION, MINECRAFT_VERSIONS } from '@shared/minecraft'
import { runtimeEnv } from '../app/locations'
import enginePin from '../../../runtime/engine.json'
import runtimeSources from '../../../runtime/sources.json'

const Artifact = z.object({
  version: z.string().regex(/^[\w.-]+$/),
  asset: z.string().regex(/^[\w.-]+\.zip$/),
  bytes: z
    .number()
    .int()
    .positive()
    .max(2 ** 31),
  sha256: z.string().regex(/^[a-f0-9]{64}$/)
})
export const RuntimeManifest = z.object({
  schema: z.literal(1),
  appVersion: z.string(),
  platform: z.literal('win32-x64'),
  engine: Artifact,
  git: Artifact
})
export type Manifest = z.infer<typeof RuntimeManifest>
type ArtifactInfo = z.infer<typeof Artifact>
type Fetcher = (url: string, options?: RequestInit) => Promise<Response>

/** No shell interpolation. Kill the complete Playwright/PowerShell child tree on cancellation. */
export function command(
  file: string,
  args: string[],
  options: {
    cwd?: string
    env?: NodeJS.ProcessEnv
    signal?: AbortSignal
    timeout?: number
  } = {}
): Promise<string> {
  return new Promise((resolve, reject) => {
    options.signal?.throwIfAborted()
    let timedOut = false
    const proc = execFile(
      file,
      args,
      {
        cwd: options.cwd,
        env: options.env,
        windowsHide: true,
        maxBuffer: 4 * 1024 * 1024
      },
      (err, stdout, stderr) => {
        options.signal?.removeEventListener('abort', stop)
        clearTimeout(timer)
        if (options.signal?.aborted) reject(new Error('Installation cancelled'))
        else if (timedOut) reject(new Error(`${file}: operation timed out`))
        else if (err) reject(new Error(`${file}: ${stderr || err.message}`))
        else resolve(stdout.trim())
      }
    )
    const stop = (): void => {
      if (process.platform === 'win32' && proc.pid)
        execFile('taskkill.exe', ['/pid', String(proc.pid), '/T', '/F'], { windowsHide: true })
      else proc.kill()
    }
    const timer = setTimeout(() => {
      timedOut = true
      stop()
    }, options.timeout ?? 120000)
    options.signal?.addEventListener('abort', stop, { once: true })
    if (options.signal?.aborted) stop()
  })
}

export function installedGit(managed = ''): string {
  for (const dir of (process.env.PATH || '').split(delimiter)) {
    const path = join(dir.replace(/^"|"$/g, ''), process.platform === 'win32' ? 'git.exe' : 'git')
    if (isAbsolute(path) && existsSync(path)) return path
  }
  return managed && existsSync(managed) ? managed : ''
}

export async function extract(
  archive: string,
  target: string,
  script: string,
  signal?: AbortSignal
): Promise<void> {
  await command(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      script,
      '-Archive',
      archive,
      '-Destination',
      target
    ],
    { signal }
  )
}

export async function downloadArtifact(
  url: string,
  info: ArtifactInfo,
  target: string,
  signal: AbortSignal,
  progress: (received: number, total: number) => void,
  headers: Record<string, string> = {},
  request: Fetcher = fetch
): Promise<void> {
  const response = await request(url, { signal, headers })
  if (!response.ok || !response.body) throw new Error(`Download failed: HTTP ${response.status}`)
  await verifiedCopy(
    Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]),
    info,
    target,
    signal,
    progress
  )
}

async function verifiedCopy(
  source: Readable,
  info: ArtifactInfo,
  target: string,
  signal: AbortSignal,
  progress: (n: number, total: number) => void
): Promise<void> {
  const hash = createHash('sha256')
  let received = 0
  const check = new Transform({
    transform(chunk, _encoding, cb) {
      received += chunk.length
      if (received > info.bytes) {
        cb(new Error('Download exceeds manifest size'))
        return
      }
      hash.update(chunk)
      progress(received, info.bytes)
      cb(null, chunk)
    }
  })
  // fetch's web stream and Node's stream definitions differ between TS library versions.
  await pipeline(source, check, createWriteStream(target, { flags: 'wx' }), { signal })
  if (received !== info.bytes || hash.digest('hex') !== info.sha256)
    throw new Error('Runtime checksum or size mismatch; retry the download')
}

export async function smoke(s: Settings, signal?: AbortSignal): Promise<void> {
  const receipt = JSON.parse(await readFile(join(s.runtime, 'runtime.json'), 'utf8'))
  if (
    receipt.engine?.identity !== enginePin.identity ||
    receipt.engine?.source?.commit !== enginePin.source.commit ||
    !enginePin.inputs.some(
      (input) =>
        input.sha256 === receipt.engine?.input?.sha256 &&
        input.manifestSha256 === receipt.engine?.input?.manifestSha256
    )
  )
    throw new Error('Runtime engine provenance mismatch')
  const env = runtimeEnv(s)
  // Never use development imports to validate an installation, or load code from the workspace.
  env.PYTHONPATH = ''
  env.SCHEMATICA_MINECRAFT_DATA = join(s.resources, '.claude/skills/schematica/minecraft_data')
  const output = await command(
    s.python,
    [
      '-s',
      '-c',
      'import json,sys,pathlib,numpy,scipy,PIL,noise,shapely,matplotlib,playwright,mcb,schematica; from tools import new_build; ' +
        'assert sys.version_info[:3]==(3,14,7); ' +
        'assert all(pathlib.Path(m.__file__).resolve().is_relative_to(pathlib.Path(sys.executable).parent.resolve()) for m in (mcb,schematica,new_build,numpy,scipy,PIL,noise,shapely,matplotlib,playwright)); ' +
        'from schematica.blocks.catalog import versions; ' +
        'assert set(versions()) == set(json.loads(sys.argv[1])), "Minecraft version catalog does not match Builder Studio"; ' +
        'from mcb.bridge import ping,check_setup; assert ping()["protocol"]==1; ' +
        'assert check_setup()["blocks"]["ok"]; print(json.dumps(ping()))',
      JSON.stringify(MINECRAFT_VERSIONS)
    ],
    { cwd: s.runtime, env, signal }
  )
  if (JSON.parse(output).python !== '3.14.7') throw new Error('Unsupported Python runtime')
  const reply = await new Promise<string>((resolve, reject) => {
    const proc = execFile(
      s.python,
      ['-s', '-m', 'mcb.bridge'],
      { cwd: s.runtime, env, windowsHide: true, timeout: 30000, signal },
      (err, stdout) => (err ? reject(err) : resolve(stdout))
    )
    proc.stdin?.end(
      '{"id":1,"method":"ping","params":{}}\n{"id":2,"method":"check_setup","params":{}}\n'
    )
  })
  const lines = reply
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line))
  if (lines.length !== 2 || lines[0].data?.protocol !== 1 || !lines[1].data?.blocks?.ok)
    throw new Error('Runtime bridge smoke check failed')
}

/** Each install creates a new `${action}-*` directory; drop the ones settings no longer point at. */
async function prune(home: string, action: string, keep: (string | undefined)[]): Promise<void> {
  const kept = new Set(keep.filter((p): p is string => !!p).map((p) => resolve(p).toLowerCase()))
  for (const name of await readdir(home)) {
    const path = join(home, name)
    if (!name.startsWith(`${action}-`) || kept.has(resolve(path).toLowerCase())) continue
    // shortcut: a folder still locked by a running process stays until the next install
    await rm(path, { recursive: true, force: true }).catch(() => undefined)
  }
}

interface RuntimeDeps {
  delivery?(): Promise<RuntimeDelivery>
  settings(): Settings
  save(s: Settings): void
  idle(): void
  home(): string
  extractScript: string
  appVersion: string
  manifest(signal: AbortSignal): Promise<Manifest>
  asset(
    info: ArtifactInfo,
    target: string,
    signal: AbortSignal,
    progress: (n: number, total: number) => void
  ): Promise<void>
  emit(s: RuntimeState): void
  validate?: typeof smoke
  unpack?: typeof extract
}

export class RuntimeService {
  state: RuntimeState = { busy: false, stage: 'idle' }
  private controller?: AbortController
  constructor(private d: RuntimeDeps) {}
  private update(s: RuntimeState): void {
    this.state = s
    this.d.emit(s)
  }
  cancel(): void {
    this.controller?.abort()
  }

  async install(action: RuntimeAction): Promise<void> {
    if (this.state.busy) throw new Error('A runtime operation is already running')
    this.d.idle()
    const controller = (this.controller = new AbortController())
    const signal = controller.signal
    const before = this.d.settings()
    const home = before.runtimeHome || this.d.home()
    let staging: string | undefined
    let candidate: string | undefined
    let activated = false
    let previous = before.previousRuntime
    const stage = (name: string): void => this.update({ busy: true, action, stage: name })
    stage('preparing')
    try {
      if (action === 'rollback') {
        if (!before.previousRuntime) throw new Error('No previous runtime is available')
        stage('validating previous runtime')
        const next = { ...before, runtime: before.previousRuntime, python: '' }
        await (this.d.validate || smoke)(
          { ...next, python: join(next.runtime, 'python.exe') },
          signal
        )
        signal.throwIfAborted()
        this.d.idle()
        this.d.save({ ...next, previousRuntime: before.runtime })
        activated = true
      } else {
        await mkdir(home, { recursive: true })
        await mkdir(join(before.cache, 'downloads'), { recursive: true })
        staging = await mkdtemp(join(before.cache, 'downloads/install-'))
        candidate = await mkdtemp(join(home, action === 'browser' ? 'browser-' : '.install-'))
        if (action === 'browser') {
          stage('validating engine')
          await (this.d.validate || smoke)(before, signal)
          stage('downloading Chromium')
          await command(
            before.python,
            ['-s', '-m', 'playwright', 'install', 'chromium', '--only-shell'],
            {
              cwd: candidate,
              signal,
              timeout: 15 * 60000,
              env: { ...runtimeEnv(before), PYTHONPATH: '', PLAYWRIGHT_BROWSERS_PATH: candidate }
            }
          )
          stage('validating Chromium')
          await browserCheck({ ...before, browser: candidate }, signal, true)
        } else {
          stage('loading manifest')
          const manifest = RuntimeManifest.parse(await this.d.manifest(signal))
          if (manifest.appVersion !== this.d.appVersion)
            throw new Error('Runtime manifest does not match this application')
          const info = manifest[action]
          const archive = join(staging, info.asset)
          const transfer =
            (await this.d.delivery?.())?.mode === 'bundled'
              ? 'verifying bundled files'
              : 'downloading'
          stage(transfer)
          let lastProgress = 0
          await this.d.asset(info, archive, signal, (received, total) => {
            if (Date.now() - lastProgress >= 100 || received === total) {
              lastProgress = Date.now()
              this.update({ busy: true, action, stage: transfer, received, total })
            }
          })
          signal.throwIfAborted()
          stage('extracting')
          await (this.d.unpack || extract)(archive, candidate, this.d.extractScript, signal)
          // Native DLL loading still has Windows path limits; full versions live in the receipt.
          const final = join(home, `${action}-${randomUUID()}`)
          await rename(candidate, final)
          candidate = final
          stage('validating')
          if (action === 'engine') {
            const receipt = JSON.parse(await readFile(join(candidate, 'runtime.json'), 'utf8'))
            if (receipt.version !== info.version || receipt.appVersion !== this.d.appVersion)
              throw new Error('Runtime archive version mismatch')
            await (this.d.validate || smoke)(
              { ...before, runtime: candidate, python: join(candidate, 'python.exe') },
              signal
            )
          } else await command(join(candidate, 'cmd/git.exe'), ['--version'], { signal })
        }
        if (
          action === 'engine' &&
          existsSync(join(before.runtime, 'python.exe')) &&
          before.python === join(before.runtime, 'python.exe')
        ) {
          stage('checking previous runtime')
          try {
            await (this.d.validate || smoke)(before, signal)
            previous = before.runtime
          } catch {
            signal.throwIfAborted()
            // A repair of a broken current version must retain the older working fallback.
          }
        }
        signal.throwIfAborted()
        this.d.idle()
        stage('activating')
        this.d.save(
          action === 'engine'
            ? {
                ...before,
                runtime: candidate,
                python: '',
                previousRuntime: previous
              }
            : action === 'git'
              ? { ...before, git: join(candidate, 'cmd/git.exe') }
              : { ...before, browser: candidate }
        )
        activated = true
        await prune(home, action, [candidate, previous])
      }
      this.update({ busy: true, action, stage: 'ready' })
    } catch (e) {
      this.update({
        busy: true,
        action,
        stage: signal.aborted ? 'cancelled' : 'failed',
        error: signal.aborted ? 'Installation cancelled; retry when ready' : String(e)
      })
      throw e
    } finally {
      try {
        if (!activated && candidate) await rm(candidate, { recursive: true, force: true })
        if (staging) await rm(staging, { recursive: true, force: true })
      } finally {
        this.controller = undefined
        this.update({ ...this.state, busy: false })
      }
    }
  }
}

export async function browserCheck(
  s: Settings,
  signal?: AbortSignal,
  managedOnly = false,
  env: NodeJS.ProcessEnv = { ...runtimeEnv(s), PYTHONPATH: '' }
): Promise<string> {
  return command(
    s.python,
    [
      '-s',
      '-c',
      'from playwright.sync_api import sync_playwright; from tools.render.render import browser_options; ' +
        'p=sync_playwright().start(); b=p.chromium.launch(headless=True, ' +
        (managedOnly ? '' : '**browser_options(), ') +
        'args=["--disable-gpu"]); page=b.new_page(); page.set_content("<p>Builder Studio</p>"); ' +
        'assert page.screenshot().hex().startswith("89504e47"); print(b.version); b.close(); p.stop()'
    ],
    { cwd: s.resources, env, signal, timeout: 30000 }
  )
}

/** Provisioned runtimes retain the strict smoke test; explicit development interpreters use resolved imports. */
export async function engineCheck(
  s: Settings,
  env = runtimeEnv(s),
  signal?: AbortSignal
): Promise<void> {
  if (s.python === join(s.runtime, 'python.exe')) return smoke(s, signal)
  await command(
    s.python,
    [
      '-s',
      '-c',
      'import json,sys,numpy,scipy,PIL,noise,shapely,matplotlib,playwright,mcb,schematica; from tools import new_build; ' +
        'from schematica.blocks.catalog import versions; ' +
        'assert set(versions()) == set(json.loads(sys.argv[1])), "Minecraft version catalog does not match Builder Studio"; ' +
        'from mcb.bridge import ping,check_setup; assert ping()["protocol"]==1; assert check_setup()["blocks"]["ok"]',
      JSON.stringify(MINECRAFT_VERSIONS)
    ],
    { cwd: s.resources, env, signal, timeout: 30000 }
  )
}

export async function packCheck(s: Settings, env = runtimeEnv(s)): Promise<string> {
  const version = s.minecraftVersion ?? DEFAULT_MINECRAFT_VERSION
  if (!existsSync(s.pack) && s.minecraftFiles?.[version]?.pack)
    throw new Error(`The selected Minecraft ${version} texture pack could not be found`)
  if (!existsSync(s.pack))
    await command(
      s.python,
      ['-s', '-c', 'from tools.render.render import ensure_pack; print(ensure_pack())'],
      { cwd: s.resources, env, timeout: 30000 }
    )
  // Windows supplies ZIP reading through .NET; an existing pack must not require Python.
  await command(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      '$ErrorActionPreference="Stop"; Add-Type -AssemblyName System.IO.Compression.FileSystem; ' +
        '$zip=[IO.Compression.ZipFile]::OpenRead($env:BS_CHECK_PACK); try { ' +
        '$meta=$zip.GetEntry("pack.mcmeta"); if (!$meta -or !($zip.Entries | Where-Object { $_.FullName -like "assets/minecraft/textures/*.png" } | Select-Object -First 1)) { throw "Select a usable Minecraft texture pack or client jar" }; ' +
        '$reader=[IO.StreamReader]::new($meta.Open()); try { $json=$reader.ReadToEnd() | ConvertFrom-Json; if (!$json.pack) { throw "Invalid pack metadata" } } finally { $reader.Dispose() }; ' +
        'Write-Output $env:BS_CHECK_PACK } finally { $zip.Dispose() }'
    ],
    { env: { ...env, BS_CHECK_PACK: s.pack }, timeout: 30000 }
  )
  return s.pack
}

export async function diagnose(s: Settings, env = runtimeEnv(s)): Promise<RuntimeDiagnostics> {
  const check = async (
    fn: () => Promise<string | void>
  ): Promise<{ ok: boolean; detail: string }> => {
    try {
      return { ok: true, detail: (await fn()) || 'validated' }
    } catch (e) {
      return { ok: false, detail: String(e) }
    }
  }
  const git = installedGit(s.git)
  const [engine, browser, gitCheck, identity] = await Promise.all([
    check(() => engineCheck(s, env)),
    check(() => browserCheck(s, undefined, false, env)),
    check(() => command(git || 'git', ['--version'])),
    check(async () => {
      if (!s.workspace) throw new Error('Select a workspace first')
      const name = await command(git || 'git', ['config', 'user.name'], { cwd: s.workspace })
      const email = await command(git || 'git', ['config', 'user.email'], { cwd: s.workspace })
      if (!name || !email) throw new Error('Commit identity is not configured')
      return `${name} <${email}>`
    })
  ])
  return { engine, browser, git: gitCheck, identity, previousRuntime: s.previousRuntime }
}

/** Both delivery modes use the exact manifest shipped with this app. */
export function packagedSource(
  directory: string,
  version: string,
  request: Fetcher = fetch
): Pick<RuntimeDeps, 'manifest' | 'asset'> & { delivery(): Promise<RuntimeDelivery> } {
  const remote = releaseSource(version, request)
  const delivery = async (): Promise<RuntimeDelivery> => {
    try {
      return z
        .object({ mode: z.enum(['bundled', 'download']) })
        .parse(JSON.parse(await readFile(join(directory, 'delivery.json'), 'utf8')))
    } catch (e) {
      throw new Error(
        'Installer delivery information is missing or invalid. Reinstall Builder Studio (in development, run prepare:delivery).',
        { cause: e }
      )
    }
  }
  return {
    delivery,
    async manifest() {
      const manifest = RuntimeManifest.parse(
        JSON.parse(await readFile(join(directory, 'runtime-manifest.json'), 'utf8'))
      )
      if (manifest.appVersion !== version)
        throw new Error('Runtime manifest does not match this application')
      return manifest
    },
    async asset(info, target, signal, progress) {
      if ((await delivery()).mode === 'bundled') {
        await verifiedCopy(
          createReadStream(join(directory, info.asset)),
          info,
          target,
          signal,
          progress
        )
      } else {
        if (info.asset !== 'builder-git-win-x64.zip') {
          const published = await remote.manifest(signal)
          if (
            published.appVersion !== version ||
            JSON.stringify(published.engine) !== JSON.stringify(info)
          )
            throw new Error('Published runtime does not match the installer manifest')
        }
        await remote.asset(info, target, signal, progress)
      }
    }
  }
}

/** Public releases never require a repository credential in the distributed application. */
export function releaseSource(
  version: string,
  request: Fetcher = fetch
): Pick<RuntimeDeps, 'manifest' | 'asset'> {
  const base = 'https://api.github.com/repos/ModerNik/builder-studio'
  let assets: { name: string; url: string }[] = []
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'Builder-Studio'
  }
  return {
    async manifest(signal) {
      const response = await request(`${base}/releases/tags/v${version}`, { signal, headers })
      if (!response.ok)
        throw new Error(
          `Release unavailable: HTTP ${response.status}. Downloads need a publicly accessible app release. This release may still be private or unpublished; retry when it is available, or use an installer with bundled tools.`
        )
      assets = (await response.json()).assets
      const info = assets.find((a) => a.name === 'runtime-manifest.json')
      if (!info) throw new Error('This release has no managed runtime; retry after publishing it')
      const result = await request(info.url, {
        signal,
        headers: { ...headers, Accept: 'application/octet-stream' }
      })
      if (!result.ok) throw new Error(`Runtime manifest unavailable: HTTP ${result.status}`)
      return RuntimeManifest.parse(await result.json())
    },
    async asset(info, target, signal, progress) {
      if (info.asset === 'builder-git-win-x64.zip') {
        if (
          info.version !== runtimeSources.git.version ||
          info.sha256 !== runtimeSources.git.sha256
        )
          throw new Error('Portable Git does not match the approved upstream distribution')
        await downloadArtifact(runtimeSources.git.url, info, target, signal, progress, {}, request)
        return
      }
      const asset = assets.find((a) => a.name === info.asset)
      if (!asset) throw new Error(`Release is missing ${info.asset}`)
      await downloadArtifact(
        asset.url,
        info,
        target,
        signal,
        progress,
        {
          ...headers,
          Accept: 'application/octet-stream'
        },
        request
      )
    }
  }
}
