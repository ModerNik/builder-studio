import type { Command } from './logic'

export const CHAT_COMMANDS = {
  compact: 'Summarize older messages to free context',
  clear: 'Start a fresh thread for this build',
  skills: 'Browse available skills',
  mcp: 'View and manage MCP servers',
  rewind: 'Continue from before a previous turn',
  fork: 'Copy this conversation into a new thread',
  context: 'Inspect context usage',
  resume: 'Open a saved conversation',
  rename: 'Rename this conversation',
  model: 'Open the model and effort menu'
} as const

export type ChatCommand = keyof typeof CHAT_COMMANDS
export type ChatCommandResult = 'skills' | 'model' | void

export const chatCommands: Command[] = Object.entries(CHAT_COMMANDS).map(([name, description]) => ({
  name,
  description,
  hint: name === 'rename' ? '[name]' : undefined
}))

export function parseChatCommand(text: string): { name: ChatCommand; args: string } | null {
  const m = /^\/([a-z]+)(?:[^\S\r\n]+(.*))?$/i.exec(text.trim())
  if (!m) return null
  const name = m[1].toLowerCase()
  return Object.hasOwn(CHAT_COMMANDS, name)
    ? { name: name as ChatCommand, args: m[2]?.trim() ?? '' }
    : null
}
