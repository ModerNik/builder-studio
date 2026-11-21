// The viewer's renderer as one ES module (three.js included) for the engine's headless PNG sheets
// (builder-studio-engine tools/render/vendor/bs-renderer). Build: npm run build:renderer-lib
import { globSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { defineConfig } from 'vite'
import { zipSync, strToU8 } from 'fflate'

const OUT = resolve('out/bs-renderer')
// everything the bundle inlines, with its licence text next to it
const BUNDLED = ['three', 'deepslate', 'fflate', 'gl-matrix', 'n8ao', 'postprocessing']

export default defineConfig({
  build: {
    outDir: OUT,
    emptyOutDir: true,
    minify: false, // readable and keeps every library's own header comments
    lib: {
      entry: resolve('src/renderer/src/entities/viewer/lib/render/index.ts'),
      formats: ['es'],
      fileName: () => 'bs-renderer.js'
    }
  },
  plugins: [
    {
      name: 'licences',
      closeBundle() {
        const text = BUNDLED.map((name) => {
          const dir = join('node_modules', name)
          const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
          const file = readdirSync(dir).find((f) => /^licen[cs]e/i.test(f))
          if (!file) throw new Error(`${name} has no licence file`)
          return `${name} ${pkg.version} — ${pkg.license}\n\n${readFileSync(join(dir, file), 'utf8').trim()}\n`
        })
        const own = [
          'Builder Studio renderer — AGPL-3.0-only',
          readFileSync('LICENSE', 'utf8'),
          readFileSync('legal/ADDITIONAL_PERMISSIONS.md', 'utf8'),
          readFileSync('legal/ADDITIONAL_TERMS.md', 'utf8'),
          readFileSync('NOTICE', 'utf8')
        ].join('\n\n')
        writeFileSync(
          join(OUT, 'LICENSES.txt'),
          [own, ...text].join('\n' + '-'.repeat(72) + '\n\n')
        )
        const sources = [
          ...globSync('src/renderer/src/entities/viewer/lib/render/**/*').filter((file) =>
            /\.(ts|py|json|schem|litematic)$/.test(file)
          ),
          'vite.renderer-lib.config.mts',
          'package.json',
          'package-lock.json',
          'LICENSE',
          'NOTICE',
          'legal/ADDITIONAL_PERMISSIONS.md',
          'legal/ADDITIONAL_TERMS.md'
        ]
        const source = Object.fromEntries(
          sources.map((file) => [file.replaceAll('\\', '/'), new Uint8Array(readFileSync(file))])
        )
        source['README.md'] = strToU8(
          '# Builder Studio renderer source\n\nThis is the preferred TypeScript source for the accompanying renderer bundle.\nUse Node 24, run npm ci, then npm run build:renderer-lib.\nThe output is out/bs-renderer/bs-renderer.js. No proprietary engine source is included.\n'
        )
        writeFileSync(join(OUT, 'SOURCE.zip'), zipSync(source))
      }
    }
  ]
})
