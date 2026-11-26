import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { Channel } from '@shared/api'
import type { IpcContext } from '../index'
import type { Handle } from './guard'

const mocks = vi.hoisted(() => ({
  workspace: '',
  clipboardWrite: vi.fn(async () => {}),
  clipboardItems: [] as Record<string, unknown>[],
  imgEmpty: false,
  imgPng: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  showSaveDialog: vi.fn(),
  showOpenDialog: vi.fn(),
  showItemInFolder: vi.fn(),
  openPath: vi.fn(async () => '')
}))

vi.mock('electron', () => ({
  clipboard: { write: mocks.clipboardWrite },
  ClipboardItem: class {
    constructor(public items: Record<string, unknown>) {
      mocks.clipboardItems.push(items)
    }
  },
  nativeImage: {
    createFromBuffer: () => ({
      isEmpty: () => mocks.imgEmpty,
      toPNG: () => mocks.imgPng
    })
  },
  dialog: {
    showSaveDialog: mocks.showSaveDialog,
    showOpenDialog: mocks.showOpenDialog
  },
  shell: {
    showItemInFolder: mocks.showItemInFolder,
    openPath: mocks.openPath
  }
}))

vi.mock('../app/settings', () => ({
  resolved: () => ({ workspace: mocks.workspace })
}))

import { registerRender } from './render'

describe('render IPC handlers', () => {
  let root = ''
  let handlers = new Map<Channel, (arg: unknown) => Promise<unknown>>()
  const broadcast = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.clipboardItems = []
    mocks.imgEmpty = false
    root = mkdtempSync(join(tmpdir(), 'studio-render-ipc-'))
    mocks.workspace = root
    mkdirSync(join(root, 'builds', 'castle', 'out'), { recursive: true })
    writeFileSync(join(root, 'builds', 'castle', 'DESIGN.md'), '# Castle\n')

    handlers = new Map()
    const handle: Handle = (channel, schema, fn) => {
      handlers.set(channel, async (arg) => fn(schema.parse(arg)))
    }
    const ctx = { state: { win: {} }, broadcast } as unknown as IpcContext
    registerRender(ctx, handle)
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('copies valid image bytes to clipboard and rejects empty/invalid images', async () => {
    const copy = handlers.get('render:copyImage')!
    await expect(copy({ data: new Uint8Array() })).rejects.toThrow('Empty image data')

    mocks.imgEmpty = true
    await expect(copy({ data: new Uint8Array([1, 2, 3]) })).rejects.toThrow(
      'could not be copied to clipboard'
    )

    mocks.imgEmpty = false
    await expect(copy({ data: new Uint8Array([1, 2, 3, 4]) })).resolves.toBeUndefined()
    expect(mocks.clipboardWrite).toHaveBeenCalledTimes(1)
    expect(mocks.clipboardItems[0]).toHaveProperty('image/png')
  })

  it('saves a single image, tracks it for reveal, and blocks arbitrary reveal paths', async () => {
    const save = handlers.get('render:saveImage')!
    const reveal = handlers.get('render:reveal')!
    const dest = join(root, 'shot.png')
    const outside = join(root, 'other.png')
    writeFileSync(outside, 'other')

    mocks.showSaveDialog.mockResolvedValueOnce({ canceled: true })
    await expect(
      save({ defaultName: 'castle:v1', format: 'png', data: new Uint8Array([9, 8, 7]) })
    ).resolves.toBeNull()
    expect(mocks.showSaveDialog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ defaultPath: 'castle_v1.png' })
    )

    mocks.showSaveDialog.mockResolvedValueOnce({ canceled: false, filePath: dest })
    await expect(
      save({ defaultName: 'castle.png', format: 'jpeg', data: new Uint8Array([1, 2, 3]) })
    ).resolves.toBe(dest)
    expect(mocks.showSaveDialog).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ defaultPath: 'castle.jpg' })
    )
    expect(readFileSync(dest)).toEqual(Buffer.from([1, 2, 3]))

    await expect(reveal(dest)).resolves.toBeUndefined()
    expect(mocks.showItemInFolder).toHaveBeenCalledWith(dest)

    await expect(reveal(outside)).rejects.toThrow('Only exported render files')
    await expect(reveal('relative.png')).rejects.toThrow('absolute')
  })

  it('saves a batch of angles to a chosen directory and allows revealing that folder', async () => {
    const saveBatch = handlers.get('render:saveBatch')!
    const reveal = handlers.get('render:reveal')!
    const dir = join(root, 'batch-out')
    mkdirSync(dir, { recursive: true })

    mocks.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: [dir] })
    await expect(
      saveBatch({
        files: [
          { name: 'v1_iso_se.png', data: new Uint8Array([1, 2]) },
          { name: 'v1_sheet.png', data: new Uint8Array([3, 4]) }
        ]
      })
    ).resolves.toEqual({ dir, count: 2 })
    expect(readFileSync(join(dir, 'v1_iso_se.png'))).toEqual(Buffer.from([1, 2]))
    expect(readFileSync(join(dir, 'v1_sheet.png'))).toEqual(Buffer.from([3, 4]))

    await expect(reveal(dir)).resolves.toBeUndefined()
    expect(mocks.openPath).toHaveBeenCalledWith(dir)

    await expect(
      saveBatch({ files: [{ name: '../escape.png', data: new Uint8Array([1]) }] })
    ).rejects.toThrow('Invalid filename')
  })

  it('saves build thumbnail and sheet previews under out/<stem>_3d and validates ownership', async () => {
    const savePreview = handlers.get('render:saveBuildPreview')!
    const relThumb = await savePreview({
      build: 'castle',
      versionPath: 'builds/castle/out/v2.litematic',
      kind: 'thumbnail',
      data: new Uint8Array([5, 6, 7])
    })
    expect(relThumb).toBe('builds/castle/out/v2_3d/preview.png')
    expect(existsSync(join(root, 'builds', 'castle', 'out', 'v2_3d', 'preview.png'))).toBe(true)
    expect(broadcast).toHaveBeenCalledWith('builds:changed')

    const relSheet = await savePreview({
      build: 'castle',
      versionPath: 'builds/castle/out/v2.litematic',
      kind: 'sheet',
      data: new Uint8Array([8, 9])
    })
    expect(relSheet).toBe('builds/castle/out/v2_3d/sheet.png')
    expect(readFileSync(join(root, 'builds', 'castle', 'out', 'v2_3d', 'sheet.png'))).toEqual(
      Buffer.from([8, 9])
    )

    await expect(
      savePreview({
        build: 'castle',
        versionPath: 'builds/other/out/v2.litematic',
        kind: 'thumbnail',
        data: new Uint8Array([1])
      })
    ).rejects.toThrow('Version does not belong to castle')
  })
})
