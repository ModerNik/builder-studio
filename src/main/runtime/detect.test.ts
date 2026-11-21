import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { SettingsSchema } from '@shared/api'
import { detected, findClaude, findCodex, findJar, shimPackage } from './detect'
import { resolveLocations } from '../app/locations'

let root = ''
const file = (p: string, size = 0): string => {
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, Buffer.alloc(size))
  return p
}
// Shims as npm and pnpm write them on Windows (checked against this PC's global installs).
const npmShim = (target: string): string =>
  `@ECHO off\r\nGOTO start\r\n:start\r\nIF EXIST "%dp0%\\node.exe" (\r\n  SET "_prog=%dp0%\\node.exe"\r\n)\r\nendLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & "%_prog%"  "%dp0%\\${target}" %*\r\n`
const pnpmShim = (target: string): string =>
  `@SETLOCAL\r\n@IF EXIST "%~dp0\\node.exe" (\r\n  "%~dp0\\node.exe"  "%~dp0\\${target}" %*\r\n)\r\n`
const exe = (name: string): string => (process.platform === 'win32' ? `${name}.exe` : name)
const platform = `${process.platform}-${process.arch}`
const triple = `${process.arch === 'arm64' ? 'aarch64' : 'x86_64'}-pc-windows-msvc`

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'studio detect '))
  for (const [key, dir] of [
    ['PATH', 'path'],
    ['APPDATA', 'roaming'],
    ['LOCALAPPDATA', 'local'],
    ['USERPROFILE', 'home'],
    ['HOME', 'home'],
    ['ProgramFiles', 'programs'],
    ['CLAUDE_CODE_GIT_BASH_PATH', '']
  ])
    vi.stubEnv(key, dir && join(root, dir))
})
afterEach(() => {
  vi.unstubAllEnvs()
  rmSync(root, { recursive: true, force: true })
})

it('finds the package an npm or pnpm shim launches', () => {
  const npm = file(join(root, 'npm', 'claude.cmd'))
  writeFileSync(npm, npmShim('node_modules\\@anthropic-ai\\claude-code\\bin\\claude.exe'))
  expect(shimPackage(npm, '@anthropic-ai/claude-code')).toBe(
    join(root, 'npm', 'node_modules', '@anthropic-ai', 'claude-code')
  )
  const pnpm = file(join(root, 'pnpm', 'codex.CMD'))
  writeFileSync(pnpm, pnpmShim('global\\5\\node_modules\\@openai\\codex\\bin\\codex.js'))
  expect(shimPackage(pnpm, '@openai/codex')).toBe(
    join(root, 'pnpm', 'global', '5', 'node_modules', '@openai', 'codex')
  )
  expect(shimPackage(pnpm, '@anthropic-ai/claude-code')).toBeNull()
})

it('resolves an npm claude.cmd on PATH to the native binary, skipping the install placeholder', () => {
  const prefix = join(root, 'path')
  writeFileSync(
    file(join(prefix, 'claude.cmd')),
    npmShim('node_modules\\@anthropic-ai\\claude-code\\bin\\claude.exe')
  )
  const pkg = join(prefix, 'node_modules', '@anthropic-ai', 'claude-code')
  file(join(pkg, 'bin', exe('claude')), 500) // postinstall never ran
  const native = file(
    join(pkg, 'node_modules', '@anthropic-ai', `claude-code-${platform}`, exe('claude')),
    1_000_001
  )
  expect(findClaude()).toBe(native)
})

it('falls back to the native installer location instead of a guessed path', () => {
  expect(findClaude()).toBeNull()
  const installed = file(join(root, 'home', '.local', 'bin', exe('claude')))
  expect(findClaude()).toBe(installed)
})

it('finds Codex through an npm shim, then the newest Codex app install', () => {
  expect(findCodex()).toBeNull()
  const bin = join(root, 'local', 'OpenAI', 'Codex', 'bin')
  const older = file(join(bin, 'a', exe('codex')))
  const newer = file(join(bin, 'b', exe('codex')))
  file(join(bin, 'c', 'rg.exe')) // helper-only folder, newest of all
  utimesSync(older, new Date(2026, 0, 1), new Date(2026, 0, 1))
  expect(findCodex()).toBe(newer)
  const prefix = join(root, 'path')
  writeFileSync(
    file(join(prefix, 'codex.cmd')),
    npmShim('node_modules\\@openai\\codex\\bin\\codex.js')
  )
  const pkg = join(prefix, 'node_modules', '@openai', 'codex')
  const vendor = join(pkg, 'node_modules', '@openai', `codex-${platform}`, 'vendor', triple)
  const vendored = file(join(vendor, 'bin', exe('codex')))
  expect(findCodex()).toBe(vendored)
})

it('picks the client jar the engine would, and reports only what empty fields resolve to', () => {
  const appData = join(root, 'roaming')
  expect(findJar(appData)).toBeNull()
  const vanilla = file(join(appData, '.minecraft', 'versions', '26.3', '26.3.jar'))
  expect(findJar(appData)).toBe(vanilla)
  file(join(appData, 'ModrinthApp', 'meta', 'versions', '26.3-0.19.5', '26.3-0.19.5.jar'))
  const modrinth = file(
    join(appData, 'ModrinthApp', 'meta', 'versions', '26.3-0.20.1', '26.3-0.20.1.jar')
  )
  file(join(appData, 'ModrinthApp', 'meta', 'versions', '26.2-0.19.5', '26.2-0.19.5.jar'))
  expect(findJar(appData)).toBe(modrinth)

  const saves = file(join(appData, '.minecraft', 'saves', 'world', 'level.dat'))
  const defaults = {
    resources: join(root, 'res'),
    runtime: join(root, 'rt', 'current'),
    cache: join(root, 'cache'),
    claude: ''
  }
  const s = SettingsSchema.parse({
    workspace: join(root, 'ws'),
    python: 'C:/custom/python.exe',
    pack: '',
    jar: '',
    schematics: '',
    claude: ''
  })
  const python = file(join(defaults.runtime, 'python.exe'))
  expect(detected(s, (x) => resolveLocations(x, defaults), appData)).toEqual({
    claude: null,
    codex: null,
    gitBash: null,
    jar: modrinth,
    saves: dirname(dirname(saves)),
    schematics: null,
    python,
    runtimeHome: join(root, 'rt'),
    cache: defaults.cache,
    assets: join(root, 'ws', 'assets')
  })
})
