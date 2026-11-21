// Licence gate + notices: walks every npm package that ships (production deps and what the renderer bundle
// imports), fails on a licence outside ALLOWED, and writes out/THIRD_PARTY_NOTICES.txt for the installer.
//   node scripts/licences.mts [site-packages dir]   (wheels of the staged engine runtime are listed by default)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ALLOWED = new Set([
  'MIT',
  'MIT-0',
  'ISC',
  '0BSD',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'Apache-2.0',
  'Zlib',
  'MPL-2.0',
  'OFL-1.1',
  'CC0-1.0',
  'Unlicense',
  'BlueOak-1.0.0',
  'Python-2.0',
  'PSF-2.0',
  'HPND',
  'MIT-CMU'
])
// This inventory entry preserves the publisher's terms; it does not establish redistribution approval.
export const COMMERCIAL = new Set(['@anthropic-ai/claude-agent-sdk'])
const commercial = (name: string): boolean =>
  [...COMMERCIAL].some((c) => name === c || name.startsWith(`${c}-`))
export const copyleft = (lic: string): boolean =>
  /(?<!Lesser )General Public License|\bA?GPL-?v?\d/i.test(lic)

/** Evaluate the allowed SPDX subset without discarding parentheses or unknown tokens. */
export function allowed(expr: string | undefined): boolean {
  if (!expr) return false
  const tokens = expr.match(/[A-Za-z0-9.+-]+|[()]/g) ?? []
  if (tokens.join('') !== expr.replace(/\s/g, '')) return false
  let at = 0
  function atom(): boolean {
    const token = tokens[at++]
    if (token !== '(') {
      if (!token || ['AND', 'OR', ')'].includes(token)) throw new Error('Expected license')
      return ALLOWED.has(token)
    }
    const result = either()
    if (tokens[at++] !== ')') throw new Error('Expected closing parenthesis')
    return result
  }
  function both(): boolean {
    let result = atom()
    while (tokens[at] === 'AND') {
      at++
      const next = atom()
      result = result && next
    }
    return result
  }
  function either(): boolean {
    let result = both()
    while (tokens[at] === 'OR') {
      at++
      const next = both()
      result = result || next
    }
    return result
  }
  try {
    const result = either()
    return at === tokens.length && result
  } catch {
    return false
  }
}

// These exact versions use non-SPDX metadata; their bundled legal files were reviewed separately.
const REVIEWED_PYTHON: Record<string, string> = {
  colorama: '0.4.6',
  cycler: '0.12.1',
  kiwisolver: '1.5.1',
  matplotlib: '3.11.2',
  noise: '1.2.2',
  // Bundled LICENSE covers the full package under BSD-3-Clause, with Apache-2.0 on newer code.
  'python-dateutil': '3.0.0',
  scipy: '1.18.1',
  trimesh: '5.2.0'
}

export function pythonAllowed(name: string, version: string, license: string): boolean {
  if (allowed(license)) return true
  if (copyleft(license)) return false
  if (name === 'mcb' && license === 'Proprietary') return true
  return REVIEWED_PYTHON[name.toLowerCase().replace(/_/g, '-')] === version
}

type Lock = {
  packages: Record<
    string,
    {
      version?: string
      license?: string
      dev?: boolean
      dependencies?: Record<string, string>
      optionalDependencies?: Record<string, string>
    }
  >
}

/** Lock path of `name` as required from `from` (node resolution: nearest node_modules up the tree). */
function resolve(lock: Lock, from: string, name: string): string | undefined {
  for (let dir = from; ; dir = dir.slice(0, Math.max(0, dir.lastIndexOf('/node_modules/')))) {
    const p = `${dir ? dir + '/' : ''}node_modules/${name}`
    if (lock.packages[p]) return p
    if (!dir) return undefined
  }
}

function rendererImports(root: string): Set<string> {
  const names = new Set<string>()
  const walk = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name)
      if (e.isDirectory()) walk(f)
      else if (/\.(tsx?|css)$/.test(e.name) && !e.name.includes('.test.'))
        for (const m of fs
          .readFileSync(f, 'utf8')
          .matchAll(/(?:from|import)\s*\(?\s*['"]([^'"./][^'"]*)['"]/g))
          names.add(
            m[1].startsWith('@') ? m[1].split('/').slice(0, 2).join('/') : m[1].split('/')[0]
          )
    }
  }
  walk(path.join(root, 'src/renderer/src'))
  return names
}

export function licenceText(dir: string): string {
  if (!fs.existsSync(dir)) return '(package is not installed on this platform)'
  const texts: string[] = []
  function walk(folder: string, legalFolder: boolean): void {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const file = path.join(folder, entry.name)
      const legal = /^(licen[cs]es?|copying|notice|authors)(?:[._-]|$)/i.test(entry.name)
      if (entry.isDirectory() && (legalFolder || legal)) walk(file, true)
      else if (entry.isFile() && (legalFolder || legal))
        texts.push(`${path.relative(dir, file)}\n\n${fs.readFileSync(file, 'utf8').trim()}`)
    }
  }
  walk(dir, false)
  return texts.join('\n\n') || '(no licence file in the package)'
}

export function wheels(site: string, bad: string[]): string[] {
  return fs
    .readdirSync(site)
    .filter((d) => d.endsWith('.dist-info'))
    .map((d) => {
      const meta = fs.readFileSync(path.join(site, d, 'METADATA'), 'utf8')
      const field = (k: string): string => meta.match(new RegExp(`^${k}: (.*)$`, 'm'))?.[1] ?? ''
      const lic =
        field('License-Expression') ||
        field('License') ||
        [...meta.matchAll(/^Classifier: License :: (.*)$/gm)].map((m) => m[1]).join('; ')
      const text = licenceText(path.join(site, d))
      if (!pythonAllowed(field('Name'), field('Version'), lic) || text.startsWith('('))
        bad.push(
          `${field('Name')} ${field('Version')} (Python) — ${lic || 'UNKNOWN'}; ${text.startsWith('(') ? text : 'license review required'}`
        )
      return `${field('Name')} ${field('Version')} (Python) — ${lic || 'reviewed non-SPDX metadata'}\n\n${text}`
    })
}

function main(): void {
  const root = path.resolve(import.meta.dirname, '..')
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8')) as Lock
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  const queue = [...Object.keys(pkg.dependencies), ...rendererImports(root)]
    .map((n) => resolve(lock, '', n))
    .filter((p): p is string => !!p)
  const seen = new Set<string>()
  const bad: string[] = []
  const entries: string[] = []
  const terms: string[] = []
  while (queue.length) {
    const p = queue.shift()!
    if (seen.has(p)) continue
    seen.add(p)
    const e = lock.packages[p]
    const name = p.slice(p.lastIndexOf('node_modules/') + 13)
    const line = `${name} ${e.version} — ${e.license ?? 'UNKNOWN'}`
    if (commercial(name)) terms.push(line)
    else if (!allowed(e.license)) bad.push(line)
    entries.push(`${line}\n\n${licenceText(path.join(root, p))}`)
    for (const d of Object.keys({ ...e.dependencies, ...e.optionalDependencies })) {
      const r = resolve(lock, p, d)
      if (r) queue.push(r)
    }
  }
  const sources = JSON.parse(fs.readFileSync(path.join(root, 'runtime/sources.json'), 'utf8'))
  const gitTag = sources.git.url.match(/\/download\/([^/]+)\//)[1]
  const head = [
    'Builder Studio licenses and notices',
    fs.readFileSync(path.join(root, 'NOTICE'), 'utf8'),
    fs.readFileSync(path.join(root, 'LICENSE'), 'utf8'),
    fs.readFileSync(path.join(root, 'legal/ADDITIONAL_PERMISSIONS.md'), 'utf8'),
    fs.readFileSync(path.join(root, 'legal/ADDITIONAL_TERMS.md'), 'utf8'),
    fs.readFileSync(path.join(root, 'legal/SHADCN-LICENSE.txt'), 'utf8'),
    fs.readFileSync(path.join(root, 'out/runtime/engine/resources/legal/ENGINE-EULA.md'), 'utf8'),
    'NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.',
    `MinGit ${sources.git.version} (bundled with the installer or downloaded from Git for Windows at setup; run as a separate program) is licensed under GPL-2.0; its ` +
      `LICENSE.txt is in its folder and the corresponding source is at https://github.com/git-for-windows/git/tree/${gitTag}`,
    `Components governed separately by their publisher's commercial terms:\n  ${terms.join('\n  ')}`
  ].join('\n\n')
  const staged = path.join(root, 'out/runtime/engine/runtime/Lib/site-packages')
  const site = process.argv[2] ?? staged
  if (!fs.existsSync(site))
    throw new Error('Stage the verified engine runtime before generating release notices')
  const body = [...entries.sort(), ...wheels(site, bad)]
  if (bad.length)
    throw new Error(`licences: not approved for release distribution:\n  ${bad.join('\n  ')}`)
  fs.mkdirSync(path.join(root, 'out'), { recursive: true })
  fs.copyFileSync(
    path.join(root, 'out/runtime/engine/resources/legal/ENGINE-EULA.md'),
    path.join(root, 'out/ENGINE-EULA.txt')
  )
  fs.writeFileSync(
    path.join(root, 'out/THIRD_PARTY_NOTICES.txt'),
    [head, ...body].join(`\n\n${'='.repeat(78)}\n\n`) + '\n'
  )
  console.log(`licences: ${entries.length} npm packages + wheels -> out/THIRD_PARTY_NOTICES.txt`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
