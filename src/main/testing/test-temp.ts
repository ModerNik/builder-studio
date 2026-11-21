// Vitest global setup: tests mkdtemp under os.tmpdir() without cleanup, so point it at one folder per run and delete that.
import { mkdtempSync, realpathSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

export default function setup(): () => void {
  const dir = realpathSync.native(mkdtempSync(join(tmpdir(), 'builder-studio-tests-')))
  for (const key of ['TEMP', 'TMP', 'TMPDIR']) process.env[key] = dir
  return () => rmSync(dir, { recursive: true, force: true, maxRetries: 5 })
}
