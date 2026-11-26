import { expect, it } from 'vitest'
import { nameFromFile } from './buildName'

it('names a project after its schematic file with spaces/symbols preserved, or leaves it empty if taken', () => {
  expect(nameFromFile('My House (2).litematic', [])).toBe('My House (2)')
  expect(nameFromFile('2024 Castle #1!.schem', [])).toBe('2024 Castle #1!')
  expect(nameFromFile('tower.schem', ['Tower'])).toBe('')
  expect(nameFromFile('con.nbt', [])).toBe('con')
  expect(nameFromFile('塔.schem', [])).toBe('塔')
  expect(nameFromFile('   .schem', [])).toBe('')
})
