// The user's own Anthropic API key. Encrypted with Electron safeStorage (DPAPI / Keychain / libsecret) in its own
// file, never in settings.json, and never sent back to the renderer: the renderer only learns whether one is set.
import { existsSync, readFileSync, rmSync, writeFileSync } from 'fs'

export interface Codec {
  isEncryptionAvailable(): boolean
  encryptString(text: string): Buffer
  decryptString(data: Buffer): string
}

export class ApiKeyStore {
  constructor(
    private file: string,
    private codec: Codec
  ) {}

  has(): boolean {
    return existsSync(this.file)
  }

  get(): string | null {
    if (!this.has()) return null
    try {
      return this.codec.decryptString(readFileSync(this.file))
    } catch {
      throw new Error(
        'The saved Anthropic API key cannot be read on this account. Enter it again in Settings → AI.'
      )
    }
  }

  /** An empty key removes the saved one. */
  set(key: string): void {
    const k = key.trim()
    if (!k) return void rmSync(this.file, { force: true })
    // a subscription token (claude setup-token) is never accepted: Builder Studio uses API keys only
    if (k.startsWith('sk-ant-oat'))
      throw new Error(
        'That is a Claude subscription token, not an API key. Create an API key in the Anthropic Console.'
      )
    if (!/^sk-ant-[\w-]{20,}$/.test(k))
      throw new Error('That is not an Anthropic API key. Keys start with sk-ant-.')
    if (!this.codec.isEncryptionAvailable())
      throw new Error('This PC cannot encrypt the key, so it was not saved.')
    writeFileSync(this.file, this.codec.encryptString(k))
  }
}
