import { describe, expect, it } from 'vitest'
import { partsContext, pickPart } from './parts'

describe('partsContext', () => {
  it('names each part with its box and source, and the untagged cells plainly', () => {
    const text = partsContext('builds/ship/out/proto.litematic', [
      {
        name: 'wing L 2',
        blocks: 412,
        box: [
          [10, 3, 40],
          [18, 9, 52]
        ],
        sources: [['builds/ship/exterior.py', 59, 'build_wings']]
      },
      {
        name: '-',
        blocks: 7,
        box: [
          [0, 0, 0],
          [1, 1, 1]
        ],
        sources: []
      }
    ])
    expect(text.split('\n')).toEqual([
      'Selected parts of builds/ship/out/proto.litematic:',
      '- "wing L 2": 412 blocks, x 10–18 y 3–9 z 40–52; opened at builds/ship/exterior.py:59 in build_wings()',
      '- untagged (written outside any c.op): 7 blocks, x 0–1 y 0–1 z 0–1',
      "Change only these parts; leave other parts' output unchanged. Line numbers are from the run that wrote this file."
    ])
  })
})

describe('pickPart', () => {
  it('selects one part, clears it on a second click, and toggles with add', () => {
    expect(pickPart(['a', 'b'], 'c', false)).toEqual(['c'])
    expect(pickPart(['c'], 'c', false)).toEqual([])
    expect(pickPart(['a', 'c'], 'c', false)).toEqual(['c'])
    expect(pickPart(['a'], 'c', true)).toEqual(['a', 'c'])
    expect(pickPart(['a', 'c'], 'c', true)).toEqual(['a'])
  })
})
