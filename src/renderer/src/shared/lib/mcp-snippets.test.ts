import { describe, expect, it } from 'vitest'
import { MCP_URL } from '@shared/constants'
import { buildAgentChatPrompt, MCP_CLIENT_SNIPPETS, workspaceMcpPath } from './mcp-snippets'

describe('mcp-snippets', () => {
  it('includes the companion MCP URL in every client snippet and produces valid Desktop JSON', () => {
    for (const item of MCP_CLIENT_SNIPPETS) {
      expect(item.snippet).toContain(MCP_URL)
    }
    const desktop = MCP_CLIENT_SNIPPETS.find((c) => c.id === 'desktop')
    expect(desktop).toBeDefined()
    const parsed = JSON.parse(desktop!.snippet) as {
      mcpServers: { 'builder-studio': { command: string; args: string[] } }
    }
    expect(parsed.mcpServers['builder-studio'].command).toBe('npx')
    expect(parsed.mcpServers['builder-studio'].args).toContain(MCP_URL)
  })

  it('builds a contextual chat prompt for named and unnamed builds', () => {
    const named = buildAgentChatPrompt('district')
    expect(named).toContain(MCP_URL)
    expect(named).toContain('guide()')
    expect(named).toContain('"district"')

    const generic = buildAgentChatPrompt('')
    expect(generic).toContain(MCP_URL)
    expect(generic).toContain('current build')
  })

  it('formats workspace .mcp.json path with matching separator', () => {
    expect(workspaceMcpPath(null)).toBe('<workspace>/.mcp.json')
    expect(workspaceMcpPath('C:\\Users\\demo\\workspace\\')).toBe(
      'C:\\Users\\demo\\workspace\\.mcp.json'
    )
    expect(workspaceMcpPath('/home/demo/workspace/')).toBe('/home/demo/workspace/.mcp.json')
  })
})
