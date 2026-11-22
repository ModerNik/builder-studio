import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, expect, it, vi } from 'vitest'
import { SettingsSchema, type Settings } from '@shared/api'
import {
  claudePrerequisites,
  codexArgs,
  codexMcp,
  ollamaEndpoint,
  ollamaModels,
  providerExecutable
} from './provider-config'

let root = ''
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  if (root) rmSync(root, { recursive: true, force: true })
})
const settings = (): Settings =>
  SettingsSchema.parse({
    workspace: 'workspace',
    python: '',
    claude: '',
    pack: '',
    jar: '',
    schematics: ''
  })

it('keeps Ollama in process overrides without shell interpretation or global config writes', () => {
  const s = { ...settings(), ollamaEndpoint: 'http://127.0.0.1:11434', ollamaModel: 'local:latest' }
  const args = codexArgs(s, true)
  expect(args.slice(0, 3)).toEqual(['app-server', '--listen', 'stdio://'])
  expect(args).toContain('model_provider="builder_ollama"')
  expect(args).toContain('model_providers.builder_ollama.base_url="http://127.0.0.1:11434/v1"')
  expect(args).toContain('model_providers.builder_ollama.wire_api="responses"')
  expect(args).toContain('approval_policy="on-request"')
  expect(args).toContain('sandbox_workspace_write.network_access=false')
  expect(args).toContain('features.default_mode_request_user_input=true')
  expect(args.join(' ')).not.toMatch(/--oss|ollama launch|ollama pull|config\.toml/)
})

it('validates endpoint origins and checks only already-installed models', async () => {
  for (const bad of [
    'file:///C:/secret',
    'ftp://localhost',
    'http://u:p@localhost',
    'http://localhost/v1',
    'http://localhost?token=x'
  ])
    expect(() => ollamaEndpoint(bad)).toThrow()
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(JSON.stringify({ models: [{ name: 'installed:latest' }] })))
  vi.stubGlobal('fetch', fetcher)
  expect(await ollamaModels(settings())).toEqual(['installed:latest'])
  expect(String(fetcher.mock.calls[0][0])).toBe('http://127.0.0.1:11434/api/tags')
  expect(fetcher).toHaveBeenCalledTimes(1)
})

it('requires a native Codex executable and does not mistake MinGit for Git Bash', () => {
  root = mkdtempSync(join(tmpdir(), 'studio prerequisites '))
  const codex = join(root, process.platform === 'win32' ? 'codex.exe' : 'codex')
  const claude = join(root, 'claude.exe')
  writeFileSync(codex, '')
  writeFileSync(claude, '')
  vi.stubEnv('PATH', root)
  vi.stubEnv('CLAUDE_CODE_GIT_BASH_PATH', '')
  vi.stubEnv('ProgramFiles', join(root, 'empty'))
  vi.stubEnv('LOCALAPPDATA', join(root, 'empty'))
  expect(providerExecutable(settings())).toBe(codex)
  expect(() => providerExecutable({ ...settings(), codex: join(root, 'codex.cmd') })).toThrow(
    'codex.exe'
  )
  if (process.platform === 'win32') {
    const git = join(root, 'mingit/cmd/git.exe')
    mkdirSync(join(root, 'mingit/cmd'), { recursive: true })
    writeFileSync(git, '')
    const s = { ...settings(), claude, git }
    expect(() => claudePrerequisites(s)).toThrow('(MinGit) has no Bash')
    const bash = join(root, 'bash.exe')
    writeFileSync(bash, '')
    expect(claudePrerequisites({ ...s, gitBash: bash })).toBe(bash)
    expect(existsSync(git)).toBe(true)
  }
})

it('explains a missing Claude Code or a shell shim in Settings instead of failing to spawn it', () => {
  root = mkdtempSync(join(tmpdir(), 'studio claude path '))
  expect(() => claudePrerequisites(settings())).toThrow('Claude Code is not installed on this PC')
  const shim = join(root, 'claude.cmd')
  writeFileSync(shim, '')
  // execFile/spawn of a .cmd without a shell fails with EINVAL, so the shim must never be accepted
  expect(() => claudePrerequisites({ ...settings(), claude: shim })).toThrow('Select claude.exe')
  expect(() => claudePrerequisites({ ...settings(), claude: 'claude.exe' })).toThrow(
    'Select claude.exe'
  )
})

it('says Ollama is not running instead of "fetch failed"', async () => {
  vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValue(new TypeError('fetch failed')))
  await expect(ollamaModels(settings())).rejects.toThrow(
    'Ollama is not reachable at http://127.0.0.1:11434. Start Ollama'
  )
})

it('turns .mcp.json into Codex overrides with env and header secrets kept off argv', () => {
  root = mkdtempSync(join(tmpdir(), 'studio mcp '))
  expect(codexMcp(root)).toEqual({ args: [], env: {}, error: null })
  const mcp = {
    mcpServers: {
      local: { command: 'node', args: ['server.js'], env: { TOKEN: 'stdio-secret' } },
      'remote-1': {
        type: 'http',
        url: 'https://mcp.example.com/mcp',
        headers: { 'X-Key': 'h-secret' }
      }
    }
  }
  writeFileSync(join(root, '.mcp.json'), JSON.stringify(mcp))
  const { args, env, error } = codexMcp(root)
  expect(error).toBeNull()
  expect(args).toEqual([
    '-c',
    'mcp_servers.local.command="node"',
    '-c',
    'mcp_servers.local.args=["server.js"]',
    '-c',
    'mcp_servers.local.env_vars=["TOKEN"]',
    '-c',
    'mcp_servers.remote-1.url="https://mcp.example.com/mcp"',
    '-c',
    'mcp_servers.remote-1.env_http_headers.X-Key="MCB_MCP_REMOTE_1_0"'
  ])
  expect(args.join(' ')).not.toMatch(/secret/)
  expect(env).toEqual({ TOKEN: 'stdio-secret', MCB_MCP_REMOTE_1_0: 'h-secret' })
})

it('reports a broken .mcp.json instead of throwing', () => {
  root = mkdtempSync(join(tmpdir(), 'studio mcp '))
  writeFileSync(join(root, '.mcp.json'), '{ nope')
  expect(codexMcp(root)).toMatchObject({
    args: [],
    env: {},
    error: expect.stringContaining('.mcp.json')
  })
  for (const bad of [
    { mcpServers: { 'bad name': { command: 'x' } } },
    { mcpServers: { a: { url: 'file:///C:/x' } } },
    { mcpServers: { a: { command: 'x', env: { K: '1' } }, b: { command: 'y', env: { K: '2' } } } }
  ]) {
    writeFileSync(join(root, '.mcp.json'), JSON.stringify(bad))
    expect(codexMcp(root)).toMatchObject({ args: [], error: expect.any(String) })
  }
})
