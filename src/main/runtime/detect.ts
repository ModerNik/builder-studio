// What each empty settings path field resolves to on this machine. File checks only; nothing is started.
import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { homedir } from 'os'
import { delimiter, dirname, isAbsolute, join } from 'path'
import type { Detected, Settings } from '@shared/api'
import { MC_VERSION } from '../app/locations'
import { MINECRAFT_VERSIONS } from '@shared/minecraft'
import { installedGit } from './runtime'
import { savesDirs } from '../workspace/site'

const exe = (name: string): string => (process.platform === 'win32' ? `${name}.exe` : name)
const usable = (p: string | undefined | false): p is string => !!p && isAbsolute(p) && existsSync(p)
const pathDirs = (): string[] =>
  (process.env.PATH ?? '').split(delimiter).map((d) => d.replace(/^"|"$/g, ''))

const packages: Record<string, string> = {
  claude: '@anthropic-ai/claude-code',
  codex: '@openai/codex'
}

/** The package folder an npm (`%dp0%\…`) or pnpm (`%~dp0\…`) .cmd shim launches. */
export function shimPackage(shim: string, pkg: string): string | null {
  const marker = `node_modules\\${pkg.replace('/', '\\')}`
  let text: string
  try {
    text = readFileSync(shim, 'utf8')
  } catch {
    return null
  }
  for (const [, target] of text.matchAll(/"%~?dp0%?\\([^"]+)"/g)) {
    const at = target.indexOf(marker)
    if (at >= 0) return join(dirname(shim), target.slice(0, at + marker.length))
  }
  return null
}

/** PATH entries first (what a terminal runs), then the npm shim a PATH entry holds. */
function onPath(name: string, fromPackage: (pkg: string) => string | undefined): string | null {
  for (const dir of pathDirs()) {
    const file = join(dir, exe(name))
    if (usable(file)) return file
    const shim = join(dir, `${name}.cmd`)
    const pkg = isAbsolute(shim) && existsSync(shim) && shimPackage(shim, packages[name])
    const found = pkg && fromPackage(pkg)
    if (found) return found
  }
  return null
}
const npmPackage = (name: string): string =>
  join(process.env.APPDATA ?? '', 'npm', 'node_modules', packages[name])

/** claude-code's bin/claude.exe is a 500-byte placeholder until its postinstall copies the native binary in. */
const npmClaude = (pkg: string): string | undefined =>
  [
    join(pkg, 'bin', exe('claude')),
    join(
      pkg,
      'node_modules',
      '@anthropic-ai',
      `claude-code-${process.platform}-${process.arch}`,
      exe('claude')
    )
  ].find((p) => usable(p) && statSync(p).size > 1_000_000)

/** Claude Code's native executable; npm .cmd shims resolve to the binary the SDK can spawn without a shell. */
export function findClaude(): string | null {
  const local = process.env.LOCALAPPDATA
  return (
    onPath('claude', npmClaude) ??
    [
      join(homedir(), '.local', 'bin', exe('claude')),
      npmClaude(npmPackage('claude')),
      local && join(local, 'Programs', 'claude', exe('claude'))
    ].find(usable) ??
    null
  )
}

/** The codex.exe the npm package vendors through its per-platform optional dependency. */
const npmCodex = (pkg: string): string | undefined => {
  const triple = `${process.arch === 'arm64' ? 'aarch64' : 'x86_64'}-pc-windows-msvc`
  const platform = join('@openai', `codex-${process.platform}-${process.arch}`, 'vendor', triple)
  return [
    join(pkg, 'node_modules', platform, 'bin', exe('codex')),
    join(dirname(dirname(pkg)), platform, 'bin', exe('codex')), // hoisted next to @openai/codex
    join(pkg, 'vendor', triple, 'codex', exe('codex')) // older packages vendored it directly
  ].find(usable)
}

/** The Codex desktop installer keeps versions in hash-named folders; some hold only helpers like rg.exe. */
function installedCodex(): string | undefined {
  const local = process.env.LOCALAPPDATA
  if (!local) return undefined
  const bin = join(local, 'OpenAI', 'Codex', 'bin')
  let dirs: string[]
  try {
    dirs = readdirSync(bin)
  } catch {
    return undefined
  }
  return dirs
    .map((d) => join(bin, d, exe('codex')))
    .filter(usable)
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0]
}

export function findCodex(): string | null {
  return onPath('codex', npmCodex) ?? npmCodex(npmPackage('codex')) ?? installedCodex() ?? null
}

/** Git for Windows' bash.exe. MinGit is deliberately not treated as Git Bash. */
export function findGitBash(managedGit = ''): string | null {
  if (process.platform !== 'win32') return null
  const git = installedGit(managedGit)
  return (
    [
      process.env.CLAUDE_CODE_GIT_BASH_PATH,
      git && join(dirname(git), '../bin/bash.exe'),
      process.env.ProgramFiles && join(process.env.ProgramFiles, 'Git/bin/bash.exe'),
      process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Programs/Git/bin/bash.exe')
    ].find(usable) ?? null
  )
}

/** Look for the exact client version, with the vanilla launcher preferred when both have it. */
export function findJar(appData: string, version = MC_VERSION): string | null {
  const jars: string[] = []
  const versions = join(appData, 'ModrinthApp', 'meta', 'versions')
  try {
    for (const d of readdirSync(versions))
      if (d === version || d.startsWith(`${version}-`))
        for (const f of readdirSync(join(versions, d)))
          if ((f === `${version}.jar` || f.startsWith(`${version}-`)) && f.endsWith('.jar'))
            jars.push(join(versions, d, f))
  } catch {
    // no Modrinth app
  }
  const vanilla = join(appData, '.minecraft', 'versions', version, `${version}.jar`)
  if (existsSync(vanilla)) jars.push(vanilla)
  return jars.sort().at(-1) ?? null
}

export function minecraftInstallations(appData: string): { version: string; jar: string }[] {
  return [...MINECRAFT_VERSIONS].reverse().flatMap((version) => {
    const jar = findJar(appData, version)
    return jar ? [{ version, jar }] : []
  })
}

/** `resolve` fills defaults the way the app does; only fields the user left empty are detected. */
export function detected(
  s: Settings,
  resolve: (s: Settings) => Settings,
  appData: string
): Detected {
  const r = resolve({ ...s, python: '', runtimeHome: '', cache: '', assets: '' })
  return {
    claude: findClaude(),
    codex: findCodex(),
    gitBash: findGitBash(s.git),
    jar: findJar(appData, s.minecraftVersion),
    saves: savesDirs(resolve(s).schematics, appData)[0] ?? null,
    schematics: resolve({ ...s, schematics: '' }).schematics || null,
    python: usable(r.python) ? r.python : null,
    runtimeHome: r.runtimeHome,
    cache: r.cache,
    assets: r.assets || null
  }
}
