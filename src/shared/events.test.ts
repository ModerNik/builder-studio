import { describe, expect, it } from 'vitest'
import { lineSplitter, parseEvent } from './events'

describe('parseEvent', () => {
  it('parses the contract lines', () => {
    expect(parseEvent('@mcb {"v":1,"event":"stage","name":"generate"}')).toEqual({ v: 1, event: 'stage', name: 'generate' })
    const wrote = parseEvent(
      '@mcb {"v":1,"event":"wrote","path":"builds/x/out/proto.litematic","shape":[100,44,52],"paste":[0,0,0]}'
    )
    expect(wrote).toMatchObject({ event: 'wrote', path: 'builds/x/out/proto.litematic', shape: [100, 44, 52] })
    expect(parseEvent('@mcb {"v":1,"event":"bill","total":3,"top":[["stone",3]]}')).toMatchObject({ top: [['stone', 3]] })
  })

  it('ignores human lines and broken event lines', () => {
    expect(parseEvent('wrote proto.litematic (100, 44, 52) paste at (0, 0, 0)')).toBeNull()
    expect(parseEvent(' @mcb {"event":"done"}')).toBeNull()
    expect(parseEvent('@mcb {"event":')).toBeNull()
    expect(parseEvent('@mcb [1,2]')).toBeNull()
    expect(parseEvent('@mcb {"v":1}')).toBeNull()
  })
})

describe('lineSplitter', () => {
  it('joins chunks and splits CRLF', () => {
    const s = lineSplitter()
    expect(s.feed('@mcb {"v":1,"ev')).toEqual([])
    expect(s.feed('ent":"done","seconds":1}\r\nblocks 5\r\npart')).toEqual(['@mcb {"v":1,"event":"done","seconds":1}', 'blocks 5'])
    expect(s.flush()).toEqual(['part'])
    expect(s.flush()).toEqual([])
  })
})
