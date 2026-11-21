import { expect, it } from 'vitest'
import { chatCommands, parseChatCommand } from './commands'

it('recognizes app commands and keeps skills and multiline messages out of app dispatch', () => {
  expect(chatCommands).toHaveLength(10)
  expect(parseChatCommand('/ReNaMe Gatehouse round 2 ')).toEqual({
    name: 'rename',
    args: 'Gatehouse round 2'
  })
  expect(parseChatCommand('/compact')).toEqual({ name: 'compact', args: '' })
  for (const text of ['$context', '/build-review', '/context\nExplain this', '/constructor'])
    expect(parseChatCommand(text)).toBeNull()
})
