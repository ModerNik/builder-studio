import { expect, it } from 'vitest'
import { nameFromFile } from './buildName'

it('names a build after its schematic file, or leaves the name empty', () => {
  expect(nameFromFile('My House (2).litematic', [])).toBe('my_house_2')
  expect(nameFromFile('2024 castle.schem', [])).toBe('build_2024_castle')
  expect(nameFromFile('tower.schem', ['tower'])).toBe('')
  expect(nameFromFile('con.nbt', [])).toBe('')
  expect(nameFromFile('塔.schem', [])).toBe('')
})
