// Model hooks for Render Studio: loads build/version/pack/edits and runs IPC image exports.
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { EditsFile, RenderImageFormat } from '@shared/api'
import { DEFAULT_MINECRAFT_VERSION } from '@shared/minecraft'
import { queryClient, studio } from '@/shared/api/studio'
import { buildUrl } from '@/shared/lib/urls'
import { useBuild } from '@/entities/build/model/builds'
import { useMinecraftPack, useSettings } from '@/entities/settings/model/settings'
import { versionName, type BuildVersion } from '@/entities/build/model/workspace'
import { useEdits } from '@/entities/block-edit/model/store'
import { AIR } from '@/entities/viewer/model/edits'
import { encodeCanvas } from '@/entities/viewer/lib/cinematic/compose'
import type { PresetId, StudioSettings } from '@/entities/viewer/lib/cinematic/presets'
import {
  useRenderStudio,
  useSheetViewer,
  useStudioSettings,
  type RenderStudioLaunch,
  type SheetViewerItem
} from './store'

function decodeEditsFile(
  file: EditsFile,
  origin?: readonly [number, number, number]
): [number, number, number, string][] {
  const [ox = 0, oy = 0, oz = 0] = origin ?? []
  const out: [number, number, number, string][] = []
  for (let i = 0; i < file.cells.length; i += 4) {
    const x = file.cells[i] - ox
    const y = file.cells[i + 1] - oy
    const z = file.cells[i + 2] - oz
    const s = file.cells[i + 3]
    out.push([x, y, z, s > 0 ? (file.states[s - 1] ?? AIR) : AIR])
  }
  return out
}

const EMPTY_EDITS: [number, number, number, string][] = []

export interface RenderTargetData {
  launch: RenderStudioLaunch | null
  sessionId: number
  open: boolean
  close: () => void
  setVersionPath: (path: string) => void
  displayName: string
  versions: BuildVersion[]
  version: BuildVersion | null
  sourceUrl: string | null
  packUrl: string | null
  packLoading: boolean
  packError: unknown
  minecraftVersion: string
  edits: [number, number, number, string][]
}

export function useRenderTarget(): RenderTargetData {
  const open = useRenderStudio((s) => s.open)
  const sessionId = useRenderStudio((s) => s.sessionId)
  const launch = useRenderStudio((s) => s.launch)
  const close = useRenderStudio((s) => s.closeStudio)
  const setVersionPath = useRenderStudio((s) => s.setVersionPath)

  const buildName = launch?.build ?? ''
  const { data: build } = useBuild(buildName)
  const settings = useSettings().data
  const versions = build?.versions ?? []
  const version = versions.find((v) => v.path === launch?.versionPath) ?? versions[0] ?? null
  const isNewest = !!version && version.path === versions[0]?.path

  const minecraftVersion =
    version?.minecraftVersion ??
    build?.minecraftVersion ??
    settings?.minecraftVersion ??
    DEFAULT_MINECRAFT_VERSION
  const pack = useMinecraftPack(open && build ? minecraftVersion : undefined)

  // Read live unsaved hand edits from the block-editor store when viewing this build, else fall back to disk
  const liveEditsBuild = useEdits((s) => s.build)
  const liveLayer = useEdits((s) => s.history.layer)
  const [diskEdits, setDiskEdits] = useState<{
    build: string
    cells: [number, number, number, string][]
  }>({ build: '', cells: [] })

  const origin = version?.origin
  useEffect(() => {
    if (!open || !buildName || !isNewest || liveEditsBuild === buildName) return
    let stale = false
    void studio.edits
      .read(buildName)
      .then((file) => {
        if (stale) return
        setDiskEdits({ build: buildName, cells: file ? decodeEditsFile(file, origin) : [] })
      })
      .catch(() => {
        if (!stale) setDiskEdits({ build: buildName, cells: [] })
      })
    return () => {
      stale = true
    }
  }, [open, buildName, isNewest, liveEditsBuild, origin])

  const edits = useMemo<[number, number, number, string][]>(() => {
    if (!isNewest) return EMPTY_EDITS
    if (liveEditsBuild === buildName) {
      if (liveLayer.size === 0) return EMPTY_EDITS
      return [...liveLayer.entries()].map(([key, state]) => {
        const [x, y, z] = key.split(',').map(Number)
        return [x, y, z, state ?? AIR]
      })
    }
    return diskEdits.build === buildName && diskEdits.cells.length > 0
      ? diskEdits.cells
      : EMPTY_EDITS
  }, [isNewest, liveEditsBuild, buildName, liveLayer, diskEdits])

  const sourceUrl = version ? buildUrl(version.path, Math.round(version.mtime)) : null

  return {
    launch,
    sessionId,
    open,
    close,
    setVersionPath,
    displayName: build?.displayName || buildName,
    versions,
    version,
    sourceUrl,
    packUrl: pack.data ?? null,
    packLoading: pack.isLoading,
    packError: pack.error,
    minecraftVersion,
    edits
  }
}

export function useRenderStudioControls(): {
  settings: StudioSettings
  applyPreset: (id: Exclude<PresetId, 'custom'>) => void
  patch: (partial: Partial<StudioSettings>, markCustom?: boolean) => void
  reset: () => void
} {
  const settings = useStudioSettings((s) => s.settings)
  const applyPreset = useStudioSettings((s) => s.applyPreset)
  const patch = useStudioSettings((s) => s.patch)
  const reset = useStudioSettings((s) => s.reset)
  return { settings, applyPreset, patch, reset }
}

export function useSheetViewerState(): {
  open: boolean
  item: SheetViewerItem | null
  src: string | null
  close: () => void
} {
  const open = useSheetViewer((s) => s.open)
  const item = useSheetViewer((s) => s.item)
  const close = useSheetViewer((s) => s.closeSheet)
  return {
    open,
    item,
    src: item ? buildUrl(item.path, item.mtime ?? 0) : null,
    close
  }
}

export async function copyCanvasToClipboard(canvas: HTMLCanvasElement): Promise<void> {
  const bytes = await encodeCanvas(canvas, 'png', 1)
  await studio.render.copyImage(bytes)
  toast.success('Render copied to clipboard')
}

export async function saveCanvasToFile(
  canvas: HTMLCanvasElement,
  build: string,
  versionPath: string | null,
  preset: string,
  format: RenderImageFormat,
  quality: number,
  suffix?: string
): Promise<string | null> {
  const bytes = await encodeCanvas(canvas, format, quality)
  const stem = versionPath ? versionName(versionPath) : build
  const defaultName = [stem, preset, suffix].filter(Boolean).join('_')
  const saved = await studio.render.saveImage(defaultName, format, bytes)
  if (saved) {
    toast.success(`Saved ${saved.split(/[\\/]/).pop()}`, {
      action: {
        label: 'Show in folder',
        onClick: () => void studio.render.reveal(saved).catch((e) => toast.error(String(e)))
      }
    })
  }
  return saved
}

export async function saveBatchCanvases(
  tiles: { id: string; canvas: HTMLCanvasElement }[],
  sheetCanvas: HTMLCanvasElement | null,
  versionPath: string | null,
  build: string,
  format: RenderImageFormat,
  quality: number
): Promise<void> {
  const ext = format === 'jpeg' ? 'jpg' : format
  const stem = versionPath ? versionName(versionPath) : build
  const files: { name: string; data: Uint8Array }[] = []
  for (const tile of tiles) {
    files.push({
      name: `${stem}_${tile.id}.${ext}`,
      data: await encodeCanvas(tile.canvas, format, quality)
    })
  }
  if (sheetCanvas) {
    files.push({
      name: `${stem}_sheet.${ext}`,
      data: await encodeCanvas(sheetCanvas, format, quality)
    })
  }
  const result = await studio.render.saveBatch(files)
  if (result) {
    toast.success(`Saved ${result.count} images to folder`, {
      action: {
        label: 'Show in folder',
        onClick: () => void studio.render.reveal(result.dir).catch((e) => toast.error(String(e)))
      }
    })
  }
}

export async function saveCanvasAsBuildPreview(
  canvas: HTMLCanvasElement,
  build: string,
  versionPath: string,
  kind: 'thumbnail' | 'sheet'
): Promise<void> {
  const bytes = await encodeCanvas(canvas, 'png', 1)
  await studio.render.saveBuildPreview(build, versionPath, kind, bytes)
  await queryClient.invalidateQueries({ queryKey: ['builds'] })
  toast.success(
    kind === 'sheet' ? 'Saved as version render sheet' : 'Updated build thumbnail in Gallery'
  )
}

export async function copyUrlImageToClipboard(src: string): Promise<void> {
  const response = await fetch(src)
  if (!response.ok) throw new Error(`Could not read image (${response.status})`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  await studio.render.copyImage(bytes)
  toast.success('Sheet copied to clipboard')
}
