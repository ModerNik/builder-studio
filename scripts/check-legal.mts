import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Release blockers: a missing or unfinished legal file, or an engine that isn't the pinned published artifact. */
export function legalErrors(root: string): string[] {
  const files = [
    'LICENSE',
    'NOTICE',
    'legal/ADDITIONAL_PERMISSIONS.md',
    'legal/ADDITIONAL_TERMS.md',
    'package.json',
    'legal/SHADCN-LICENSE.txt',
    'out/runtime/engine/resources/legal/ENGINE-EULA.md'
  ]
  const errors = files
    .filter((file) => !fs.existsSync(path.join(root, file)))
    .map((file) => `Missing legal file: ${file}`)
  for (const file of files.filter((file) => fs.existsSync(path.join(root, file))))
    if (/\[(LEGAL_[A-Z_]+|EFFECTIVE_DATE)\]/.test(fs.readFileSync(path.join(root, file), 'utf8')))
      errors.push(`Unresolved legal placeholder in ${file}`)
  const pinFile = path.join(root, 'runtime/engine.json')
  const receiptFile = path.join(root, 'out/runtime/runtime-manifest.json')
  if (!fs.existsSync(pinFile) || !fs.existsSync(receiptFile))
    errors.push('Stage a pinned published engine before release')
  else {
    const pin = JSON.parse(fs.readFileSync(pinFile, 'utf8'))
    const input = JSON.parse(fs.readFileSync(receiptFile, 'utf8')).provenance?.input
    if (
      !pin.publication ||
      pin.publication.kind !== 'release' ||
      !input ||
      input.sha256 !== pin.publication.sha256 ||
      input.manifestSha256 !== pin.publication.manifestSha256
    )
      errors.push('Pin and stage the actual published engine artifact before release')
  }
  return errors
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = legalErrors(path.resolve(import.meta.dirname, '..'))
  if (errors.length) throw new Error(errors.join('\n'))
  console.log('Legal files are present and the published engine is staged')
}
