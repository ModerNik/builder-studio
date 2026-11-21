import { mkdtempSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { ApiKeyStore, type Codec } from './api-key'

const KEY = 'sk-ant-api03-' + 'unit-test-'.repeat(4)
// reverses the bytes, so a plain-text key on disk would show up
const codec = (available = true): Codec => ({
  isEncryptionAvailable: () => available,
  encryptString: (t) => Buffer.from([...Buffer.from(t)].reverse()),
  decryptString: (b) => Buffer.from([...b].reverse()).toString()
})
const store = (c = codec()): { s: ApiKeyStore; file: string } => {
  const file = join(mkdtempSync(join(tmpdir(), 'key-')), 'anthropic-key.bin')
  return { s: new ApiKeyStore(file, c), file }
}

describe('ApiKeyStore', () => {
  it('saves the key encrypted and reads it back', () => {
    const { s, file } = store()
    expect(s.has()).toBe(false)
    expect(s.get()).toBeNull()
    s.set(`  ${KEY}\n`)
    expect(s.has()).toBe(true)
    expect(readFileSync(file).toString()).not.toContain('sk-ant')
    expect(s.get()).toBe(KEY)
  })

  it('removes the key when it is cleared', () => {
    const { s } = store()
    s.set(KEY)
    s.set('')
    expect(s.has()).toBe(false)
  })

  it('refuses subscription tokens and malformed keys', () => {
    const { s } = store()
    expect(() => s.set('sk-ant-oat01-' + 'unit-test-'.repeat(4))).toThrow(/subscription token/)
    expect(() => s.set('hello')).toThrow(/not an Anthropic API key/)
    expect(s.has()).toBe(false)
  })

  it('never writes the key when encryption is unavailable', () => {
    const { s } = store(codec(false))
    expect(() => s.set(KEY)).toThrow(/cannot encrypt/)
    expect(s.has()).toBe(false)
  })
})
