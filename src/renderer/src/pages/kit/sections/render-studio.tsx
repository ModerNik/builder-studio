// /kit section for Render Studio Lightbox components (PresetGrid, StudioRail, SheetViewerLightbox).
import { useState, type ReactElement } from 'react'
import { Button } from '@/shared/ui/primitives/button'
import {
  defaultStudioSettings,
  getPreset,
  type PresetId,
  type StudioSettings
} from '@/entities/viewer/lib/cinematic/presets'
import { PresetGrid } from '@/features/render-studio/ui/PresetGrid'
import { StudioRail, type StudioRailTab } from '@/features/render-studio/ui/StudioRail'
import { SheetViewerLightbox } from '@/features/render-studio/ui/SheetViewerLightbox'

export const meta = { group: 'Viewer', title: 'Render Studio' }

export default function RenderStudioSection(): ReactElement {
  const [settings, setSettings] = useState<StudioSettings>(() => defaultStudioSettings())
  const [tab, setTab] = useState<StudioRailTab>('look')
  const [clipY, setClipY] = useState<number | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const onPreset = (id: Exclude<PresetId, 'custom'>): void =>
    setSettings((s) => ({ ...s, ...getPreset(id).look, preset: id }))
  const onPatch = (partial: Partial<StudioSettings>, markCustom = false): void =>
    setSettings((s) => ({ ...s, ...partial, ...(markCustom ? { preset: 'custom' as const } : {}) }))

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-fg-secondary">Preset swatch grid</h3>
        <div className="max-w-xs">
          <PresetGrid value={settings.preset} onChange={onPreset} />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-fg-secondary">Studio inspector rail</h3>
        <div className="h-[36rem] w-80 overflow-hidden rounded-lg border border-border-default bg-surface-panel">
          <StudioRail
            tab={tab}
            onTabChange={setTab}
            settings={settings}
            onPreset={onPreset}
            onPatch={onPatch}
            onReset={() => setSettings(defaultStudioSettings())}
            clipY={clipY}
            height={32}
            onClipY={setClipY}
            emissiveCount={24}
            hasEdits
            stageAspect={16 / 9}
            busy={false}
            onCopy={() => {}}
            onSave={() => {}}
            onBatchSave={() => {}}
            onSaveThumbnail={() => {}}
            onSaveSheet={() => {}}
            canSaveToBuild
          />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-fg-secondary">Agent sheet lightbox</h3>
        <div>
          <Button size="sm" variant="outline" onClick={() => setSheetOpen(true)}>
            Open SheetViewerLightbox
          </Button>
        </div>
        <SheetViewerLightbox
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          title="castle · v4_3d/sheet.png"
          src={null}
        />
      </section>
    </div>
  )
}
