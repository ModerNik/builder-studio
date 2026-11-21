import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { expect, it } from 'vitest'
import { SettingsSchema } from '@shared/api'
import { packCheck } from './runtime'

// A tiny valid resource ZIP: pack.mcmeta and a one-pixel Minecraft texture.
const PACK =
  'UEsDBBQAAAAIAE5kX11r8dvcLgAAADAAAAALAAAAcGFjay5tY21ldGGrVipITM5WsqoG0/Fp+UW5iSVKVpbmOkopqcXJRZkFJZn5eUpWSiWpxSVKtbUAUEsDBBQAAAAIAE5kX10zMwpxRAAAAEQAAAApAAAAYXNzZXRzL21pbmVjcmFmdC90ZXh0dXJlcy9ibG9jay9zdG9uZS5wbmfrDPBz5+WS4mJgYOD19HAJYmBgYARhDhYGBoatMjxMDAwM3J4ujiEVt5JTfvAzMLIyMqpLPE5jYGBg8HT1c1nnlNAEAFBLAQIUABQAAAAIAE5kX11r8dvcLgAAADAAAAALAAAAAAAAAAAAAACAAQAAAABwYWNrLm1jbWV0YVBLAQIUABQAAAAIAE5kX10zMwpxRAAAAEQAAAApAAAAAAAAAAAAAACAAVcAAABhc3NldHMvbWluZWNyYWZ0L3RleHR1cmVzL2Jsb2NrL3N0b25lLnBuZ1BLBQYAAAAAAgACAJAAAADiAAAAAAA='

it.skipIf(process.platform !== 'win32')(
  'validates an existing pack without Python and rejects a damaged ZIP',
  async () => {
    const root = mkdtempSync(join(tmpdir(), 'studio pack сборка '))
    try {
      const pack = join(root, 'pack.zip')
      writeFileSync(pack, Buffer.from(PACK, 'base64'))
      const s = SettingsSchema.parse({
        workspace: root,
        resources: root,
        python: join(root, 'no-python.exe'),
        pack,
        jar: '',
        schematics: '',
        claude: ''
      })
      await expect(packCheck(s)).resolves.toBe(pack)
      writeFileSync(pack, 'damaged ZIP')
      await expect(packCheck(s)).rejects.toThrow()
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  },
  15000
)
