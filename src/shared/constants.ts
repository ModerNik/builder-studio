// Plain constants shared by main and renderer. No zod here: the renderer imports this at boot.
import type { AgentCapabilities, LinterSettings, LintRuleToggles, Provider } from './api'

export const PROJECT_NAME_MAX_LENGTH = 100

/** The companion MCP server for external agents (src/main/agent/mcp.ts), loopback only. */
export const MCP_PORT = 7341
export const MCP_URL = `http://127.0.0.1:${MCP_PORT}/mcp`

export const PROVIDERS = ['claude', 'codex', 'ollama'] as const
const CLAUDE = {
  variants: true,
  fork: true,
  compact: true,
  cost: true,
  effort: true,
  mcpToggle: true,
  modes: ['default', 'acceptEdits', 'auto', 'plan'] as const
}
// no acceptEdits: Codex's workspace-write sandbox never asks for edits inside the workspace anyway
const CODEX = {
  variants: true,
  fork: true,
  compact: true,
  cost: false,
  effort: true,
  mcpToggle: true,
  modes: ['default', 'auto', 'plan'] as const
}
export const CAPABILITIES: Record<Provider, AgentCapabilities> = {
  claude: CLAUDE,
  codex: CODEX,
  ollama: { ...CODEX, effort: false }
}
export const SETUP_STEPS = ['welcome', 'workspace', 'runtime', 'minecraft', 'ai', 'verify'] as const
/** UI scale steps for Ctrl - and Ctrl +, as in browsers. */
export const UI_SCALES = [0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2] as const

export const LINT_RULES = [
  'floating',
  'unattached',
  'gravity',
  'halves',
  'fire',
  'leaves',
  'invalid',
  'dark',
  'see_through',
  'groove'
] as const
export const DEFAULT_LINT_RULES: LintRuleToggles = {
  floating: false,
  unattached: true,
  gravity: true,
  halves: true,
  fire: true,
  leaves: true,
  invalid: true,
  dark: true,
  see_through: true,
  groove: true
}
export const DEFAULT_LINTER_SETTINGS: LinterSettings = {
  enabled: true,
  rules: { ...DEFAULT_LINT_RULES }
}
export const MAX_JOBS = 30 // jobs main and the renderer keep, newest first
export const MAX_JOB_LOG = 5000 // lines a job keeps: the tail, where a failure's traceback is
export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const
// the Claude SDK's PermissionMode names: Manual, Accept edits, Auto (a classifier approves), Plan
export const MODES = ['default', 'acceptEdits', 'auto', 'plan'] as const
