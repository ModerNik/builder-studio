import { clipboard, ClipboardItem, dialog, nativeImage, shell } from 'electron'
import { existsSync } from 'fs'
import { mkdir, writeFile } from 'fs/promises'
import { isAbsolute, join, posix, resolve } from 'path'
import { z } from 'zod'
import {
  RenderCopyImageSchema,
  RenderSaveBatchSchema,
  RenderSaveBuildPreviewSchema,
  RenderSaveImageSchema,
  type RenderImageFormat
} from '@shared/api'
import { resolved } from '../app/settings'
import { buildDir } from '../workspace/projects'
import { under, writeAtomic } from '../workspace/paths'
import { noLinks } from '../workspace/workspace'
import type { IpcContext } from '../index'
import type { Handle } from './guard'

const FORMAT_FILTER: Record<RenderImageFormat, { name: string; extensions: string[] }> = {
  png: { name: 'PNG Image', extensions: ['png'] },
  webp: { name: 'WebP Image', extensions: ['webp'] },
  jpeg: { name: 'JPEG Image', extensions: ['jpg', 'jpeg'] }
}

const VERSION_PATH = /^builds\/((?:_[\w.-]+\/)?[\w.-]+)\/out\/([\w.-]+)\.litematic$/

function ensureExtension(name: string, format: RenderImageFormat): string {
  const ext = format === 'jpeg' ? '.jpg' : `.${format}`
  const clean = name.replace(/[<>:"/\\|?*]+/g, '_').trim() || 'render'
  return clean.toLowerCase().endsWith(ext)
    ? clean
    : `${clean.replace(/\.(png|webp|jpe?g)$/i, '')}${ext}`
}

function trackRecent(set: Set<string>, path: string, limit = 50): void {
  set.delete(path)
  set.add(path)
  if (set.size > limit) set.delete(set.values().next().value!)
}

/** Render Studio image export: clipboard copy, single/batch save dialogs, reveal, and saving build previews. */
export function registerRender(ctx: IpcContext, handle: Handle): void {
  const { state, broadcast } = ctx
  const savedFiles = new Set<string>()
  const savedDirs = new Set<string>()

  handle('render:copyImage', RenderCopyImageSchema, async ({ data }) => {
    const buf = Buffer.from(data)
    const img = nativeImage.createFromBuffer(buf)
    if (img.isEmpty()) throw new Error('Rendered image could not be copied to clipboard')
    const png = img.toPNG()
    await clipboard.write([
      new ClipboardItem({ 'image/png': new Blob([new Uint8Array(png)], { type: 'image/png' }) })
    ])
  })

  handle('render:saveImage', RenderSaveImageSchema, async ({ defaultName, format, data }) => {
    const result = await dialog.showSaveDialog(state.win!, {
      title: 'Save render',
      defaultPath: ensureExtension(defaultName, format),
      filters: [FORMAT_FILTER[format]]
    })
    if (result.canceled || !result.filePath) return null
    await writeFile(result.filePath, Buffer.from(data))
    trackRecent(savedFiles, resolve(result.filePath))
    return result.filePath
  })

  handle('render:saveBatch', RenderSaveBatchSchema, async ({ files }) => {
    const result = await dialog.showOpenDialog(state.win!, {
      title: 'Choose folder for rendered angles',
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || !result.filePaths[0]) return null
    const dir = result.filePaths[0]
    await Promise.all(
      files.map((file) => {
        const clean = file.name.replace(/[<>:"/\\|?*]+/g, '_').trim()
        if (!clean || clean === '.' || clean === '..')
          throw new Error(`Invalid output file name: ${file.name}`)
        return writeFile(join(dir, clean), Buffer.from(file.data))
      })
    )
    trackRecent(savedDirs, resolve(dir))
    return { dir, count: files.length }
  })

  handle('render:reveal', z.string().min(1), async (path) => {
    if (!isAbsolute(path)) throw new Error('Reveal path must be absolute')
    const full = resolve(path)
    const isFile = savedFiles.has(full)
    const isDir = savedDirs.has(full)
    if (!isFile && !isDir) throw new Error('Only exported render files can be revealed')
    if (!existsSync(full)) throw new Error(`File not found: ${path}`)
    if (isFile) {
      shell.showItemInFolder(full)
    } else {
      const err = await shell.openPath(full)
      if (err) throw new Error(err)
    }
  })

  handle(
    'render:saveBuildPreview',
    RenderSaveBuildPreviewSchema,
    async ({ build, versionPath, kind, data }) => {
      const repo = resolved().workspace
      if (!repo) throw new Error('Choose a workspace folder in Settings first')
      buildDir(repo, build)
      const match = VERSION_PATH.exec(versionPath)
      if (!match || match[1] !== build)
        throw new Error(`Version does not belong to ${build}: ${versionPath}`)
      const stem = match[2]
      const fileName = kind === 'sheet' ? 'sheet.png' : 'preview.png'
      const rel = posix.join('builds', build, 'out', `${stem}_3d`, fileName)
      const dest = under(repo, rel)
      if (!dest) throw new Error(`Invalid preview path: ${rel}`)
      await noLinks(join(repo, 'builds', build, 'out'))
      await mkdir(join(repo, 'builds', build, 'out', `${stem}_3d`), { recursive: true })
      await noLinks(dest)
      writeAtomic(dest, Buffer.from(data))
      broadcast('builds:changed')
      return rel
    }
  )
}
