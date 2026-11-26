// Right-hand inspector rail for Render Studio: Look (presets, sky, shaders), Camera & Framing, and Export.
import type { ReactElement, ReactNode } from 'react'
import {
  Camera,
  ChevronDown,
  Copy,
  Download,
  FolderDown,
  Image as ImageIcon,
  Layers,
  RotateCcw,
  Sliders,
  Sparkles
} from 'lucide-react'
import type { RenderImageFormat } from '@shared/api'
import { Badge } from '@/shared/ui/primitives/badge'
import { Button } from '@/shared/ui/primitives/button'
import { Checkbox } from '@/shared/ui/primitives/checkbox'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/shared/ui/primitives/collapsible'
import { ColourField } from '@/shared/ui/primitives/colour-field'
import { Field } from '@/shared/ui/primitives/field'
import { SegmentedControl, SegmentedControlItem } from '@/shared/ui/primitives/toggle-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/shared/ui/primitives/select'
import { Slider } from '@/shared/ui/primitives/slider'
import { Switch } from '@/shared/ui/primitives/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/primitives/tabs'
import {
  RESOLUTION_OPTIONS,
  resolveExportSize,
  STUDIO_CAMERA_PRESETS,
  type AspectRatio,
  type BackdropMode,
  type CompositionGuide,
  type DofMode,
  type PresetId,
  type ResolutionPreset,
  type StudioCameraPreset,
  type StudioSettings
} from '@/entities/viewer/lib/cinematic/presets'
import { PresetGrid } from './PresetGrid'

export type StudioRailTab = 'look' | 'camera' | 'export'

function SectionTitle({ title, badge }: { title: string; badge?: ReactNode }): ReactElement {
  return (
    <div className="flex items-center justify-between gap-2 pt-1">
      <h3 className="text-xs font-semibold tracking-wide text-fg-secondary uppercase">{title}</h3>
      {badge}
    </div>
  )
}

function SliderRow({
  label,
  value,
  display,
  min,
  max,
  step,
  disabled,
  onChange
}: {
  label: string
  value: number
  display: string
  min: number
  max: number
  step: number
  disabled?: boolean
  onChange: (value: number) => void
}): ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-fg-secondary">{label}</span>
        <span className="font-mono text-fg-muted tabular-nums">{display}</span>
      </div>
      <Slider
        aria-label={label}
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  )
}

export function StudioRail({
  tab,
  onTabChange,
  settings,
  onPreset,
  onPatch,
  onReset,
  clipY,
  height,
  onClipY,
  emissiveCount,
  hasEdits,
  stageAspect,
  busy,
  onCopy,
  onSave,
  onBatchSave,
  onSaveThumbnail,
  onSaveSheet,
  canSaveToBuild
}: {
  tab: StudioRailTab
  onTabChange: (tab: StudioRailTab) => void
  settings: StudioSettings
  onPreset: (preset: Exclude<PresetId, 'custom'>) => void
  onPatch: (partial: Partial<StudioSettings>, markCustom?: boolean) => void
  onReset: () => void
  clipY: number | null
  height: number
  onClipY: (y: number | null) => void
  emissiveCount: number
  hasEdits: boolean
  stageAspect: number
  busy: boolean
  onCopy: () => void
  onSave: () => void
  onBatchSave: () => void
  onSaveThumbnail: () => void
  onSaveSheet: () => void
  canSaveToBuild: boolean
}): ReactElement {
  const exportSize = resolveExportSize(settings.resolution, settings.aspect, stageAspect)
  const topY = Math.max(height - 1, 0)
  const toggleAngle = (id: StudioCameraPreset, on: boolean): void => {
    const next = on ? [...settings.sheetViews, id] : settings.sheetViews.filter((v) => v !== id)
    if (next.length > 0) onPatch({ sheetViews: next })
  }

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => onTabChange(v as StudioRailTab)}
      className="flex h-full min-h-0 flex-col gap-0"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-border-subtle px-3 py-2">
        <TabsList variant="line" className="w-full justify-between">
          <TabsTrigger value="look" className="flex-1 gap-1.5 text-sm">
            <Sparkles aria-hidden="true" className="size-3.5" />
            Look
          </TabsTrigger>
          <TabsTrigger value="camera" className="flex-1 gap-1.5 text-sm">
            <Camera aria-hidden="true" className="size-3.5" />
            Camera
          </TabsTrigger>
          <TabsTrigger value="export" className="flex-1 gap-1.5 text-sm">
            <Download aria-hidden="true" className="size-3.5" />
            Export
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="look" className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3">
        <div className="flex flex-col gap-2">
          <SectionTitle
            title="Presets"
            badge={
              settings.preset === 'custom' ? (
                <Badge variant="outline" className="text-2xs">
                  Custom
                </Badge>
              ) : null
            }
          />
          <PresetGrid value={settings.preset} onChange={onPreset} />
        </div>

        <div className="flex flex-col gap-3 border-t border-border-subtle pt-3">
          <SectionTitle title="Lighting & Sky" />
          <Field label="Shading">
            <SegmentedControl
              size="sm"
              aria-label="Shading mode"
              value={settings.lightingMode}
              onValueChange={(v) =>
                v && onPatch({ lightingMode: v as StudioSettings['lightingMode'] }, true)
              }
              className="w-full"
            >
              <SegmentedControlItem value="sun" className="flex-1">
                Sun
              </SegmentedControlItem>
              <SegmentedControlItem value="game" className="flex-1">
                Game
              </SegmentedControlItem>
              <SegmentedControlItem value="flat" className="flex-1">
                Flat
              </SegmentedControlItem>
            </SegmentedControl>
          </Field>

          {settings.lightingMode === 'sun' && (
            <>
              <SliderRow
                label="Sun azimuth"
                value={settings.sunAzimuth}
                display={`${Math.round(settings.sunAzimuth)}°`}
                min={0}
                max={360}
                step={1}
                onChange={(sunAzimuth) => onPatch({ sunAzimuth }, true)}
              />
              <SliderRow
                label="Sun elevation"
                value={settings.sunElevation}
                display={`${Math.round(settings.sunElevation)}°`}
                min={-15}
                max={85}
                step={1}
                onChange={(sunElevation) => onPatch({ sunElevation }, true)}
              />
              <SliderRow
                label="Sun intensity"
                value={settings.sunIntensity}
                display={`${Math.round(settings.sunIntensity * 100)}%`}
                min={0.2}
                max={2}
                step={0.05}
                onChange={(sunIntensity) => onPatch({ sunIntensity }, true)}
              />
            </>
          )}

          <Field label="Backdrop">
            <Select
              value={settings.backdrop}
              onValueChange={(v) => onPatch({ backdrop: v as BackdropMode }, true)}
            >
              <SelectTrigger size="sm" aria-label="Backdrop">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sky">Physical sky dome</SelectItem>
                <SelectItem value="studio">Studio gradient</SelectItem>
                <SelectItem value="solid">Solid color</SelectItem>
                <SelectItem value="transparent">Transparent PNG</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {(settings.backdrop === 'studio' || settings.backdrop === 'solid') && (
            <Field label="Background color">
              <ColourField
                value={settings.bgColor}
                onChange={(bgColor) => onPatch({ bgColor }, true)}
              />
            </Field>
          )}

          {settings.lightingMode === 'sun' && (
            <>
              <Field label="Ground shadow catcher" orientation="horizontal">
                <Switch
                  checked={settings.groundShadow}
                  onCheckedChange={(groundShadow) => onPatch({ groundShadow }, true)}
                />
              </Field>
              {settings.groundShadow && (
                <SliderRow
                  label="Shadow opacity"
                  value={settings.groundShadowOpacity}
                  display={`${Math.round(settings.groundShadowOpacity * 100)}%`}
                  min={0.05}
                  max={0.75}
                  step={0.05}
                  onChange={(groundShadowOpacity) => onPatch({ groundShadowOpacity }, true)}
                />
              )}
            </>
          )}

          {settings.backdrop !== 'transparent' && (
            <>
              <Field label="Atmospheric haze (perspective)" orientation="horizontal">
                <Switch checked={settings.fog} onCheckedChange={(fog) => onPatch({ fog }, true)} />
              </Field>
              {settings.fog && (
                <SliderRow
                  label="Haze density"
                  value={settings.fogDensity}
                  display={`${Math.round(settings.fogDensity * 100)}%`}
                  min={0.05}
                  max={1}
                  step={0.05}
                  onChange={(fogDensity) => onPatch({ fogDensity }, true)}
                />
              )}
            </>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-border-subtle pt-3">
          <SectionTitle
            title="Shaders & Post"
            badge={
              emissiveCount > 0 ? (
                <Badge variant="outline" className="font-mono text-2xs tabular-nums">
                  {emissiveCount} light {emissiveCount === 1 ? 'block' : 'blocks'}
                </Badge>
              ) : null
            }
          />

          <SliderRow
            label="Ambient occlusion (N8AO)"
            value={settings.aoStrength}
            display={
              settings.aoStrength <= 0.01 ? 'Off' : `${Math.round(settings.aoStrength * 100)}%`
            }
            min={0}
            max={2}
            step={0.05}
            disabled={settings.backdrop === 'transparent'}
            onChange={(aoStrength) => onPatch({ aoStrength }, true)}
          />

          <SliderRow
            label="Emissive glow"
            value={settings.emissiveGlow}
            display={
              settings.emissiveGlow <= 0.01 ? 'Off' : `${Math.round(settings.emissiveGlow * 100)}%`
            }
            min={0}
            max={2.5}
            step={0.05}
            onChange={(emissiveGlow) => onPatch({ emissiveGlow }, true)}
          />

          {settings.emissiveGlow > 0.01 && (
            <Field label="Warm block light fill" orientation="horizontal">
              <Switch
                checked={settings.emissiveLights}
                onCheckedChange={(emissiveLights) => onPatch({ emissiveLights }, true)}
              />
            </Field>
          )}

          <SliderRow
            label="Selective bloom"
            value={settings.bloomStrength}
            display={
              settings.bloomStrength <= 0.005
                ? 'Off'
                : `${Math.round(settings.bloomStrength * 100)}%`
            }
            min={0}
            max={1.4}
            step={0.02}
            onChange={(bloomStrength) => onPatch({ bloomStrength }, true)}
          />

          {settings.lightingMode === 'sun' && (
            <SliderRow
              label="Water sheen"
              value={settings.waterSheen}
              display={
                settings.waterSheen <= 0.05
                  ? 'Vanilla'
                  : `${Math.round(settings.waterSheen * 100)}%`
              }
              min={0}
              max={1}
              step={0.05}
              onChange={(waterSheen) => onPatch({ waterSheen }, true)}
            />
          )}

          <Field label="Depth of field">
            <SegmentedControl
              size="sm"
              aria-label="Depth of field mode"
              value={settings.dofMode}
              onValueChange={(v) => v && onPatch({ dofMode: v as DofMode }, true)}
              className="w-full"
            >
              <SegmentedControlItem value="off" className="flex-1">
                Off
              </SegmentedControlItem>
              <SegmentedControlItem value="tilt-shift" className="flex-1">
                Tilt-Shift
              </SegmentedControlItem>
              <SegmentedControlItem value="focus" className="flex-1">
                Radial
              </SegmentedControlItem>
            </SegmentedControl>
          </Field>

          {settings.dofMode !== 'off' && (
            <>
              <SliderRow
                label="Blur strength"
                value={settings.dofAperture}
                display={`${Math.round(settings.dofAperture * 100)}%`}
                min={0}
                max={1}
                step={0.05}
                onChange={(dofAperture) => onPatch({ dofAperture }, true)}
              />
              <p className="text-xs text-fg-muted">
                Click anywhere on the preview stage to move the focal point.
              </p>
            </>
          )}

          <Field label="Stained glass">
            <SegmentedControl
              size="sm"
              aria-label="Stained glass rendering"
              value={settings.glass}
              onValueChange={(v) => v && onPatch({ glass: v as 'blend' | 'opaque' }, true)}
              className="w-full"
            >
              <SegmentedControlItem value="blend" className="flex-1">
                Translucent
              </SegmentedControlItem>
              <SegmentedControlItem value="opaque" className="flex-1">
                Solid tint
              </SegmentedControlItem>
            </SegmentedControl>
          </Field>

          <Collapsible>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="focus-ring flex w-full items-center justify-between rounded-md py-1 text-xs font-semibold tracking-wide text-fg-secondary uppercase can-hover:text-fg"
              >
                <span className="flex items-center gap-1.5">
                  <Sliders aria-hidden="true" className="size-3.5" />
                  Color grading
                </span>
                <ChevronDown aria-hidden="true" className="size-3.5" />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="flex flex-col gap-3 pt-2">
              <Field label="Tone mapping">
                <SegmentedControl
                  size="sm"
                  aria-label="Tone mapping"
                  value={settings.toneMapping}
                  onValueChange={(v) => v && onPatch({ toneMapping: v as 'linear' | 'aces' }, true)}
                  className="w-full"
                >
                  <SegmentedControlItem value="aces" className="flex-1">
                    ACES Filmic
                  </SegmentedControlItem>
                  <SegmentedControlItem value="linear" className="flex-1">
                    Linear
                  </SegmentedControlItem>
                </SegmentedControl>
              </Field>
              <SliderRow
                label="Exposure"
                value={settings.exposure}
                display={settings.exposure.toFixed(2)}
                min={0.5}
                max={1.8}
                step={0.02}
                onChange={(exposure) => onPatch({ exposure }, true)}
              />
              <SliderRow
                label="Contrast"
                value={settings.contrast}
                display={`${settings.contrast >= 0 ? '+' : ''}${Math.round(settings.contrast * 100)}%`}
                min={-0.4}
                max={0.5}
                step={0.02}
                onChange={(contrast) => onPatch({ contrast }, true)}
              />
              <SliderRow
                label="Saturation"
                value={settings.saturation}
                display={`${settings.saturation >= 0 ? '+' : ''}${Math.round(settings.saturation * 100)}%`}
                min={-0.6}
                max={0.6}
                step={0.02}
                onChange={(saturation) => onPatch({ saturation }, true)}
              />
              <SliderRow
                label="Temperature"
                value={settings.temperature}
                display={
                  settings.temperature === 0
                    ? 'Neutral'
                    : settings.temperature > 0
                      ? `Warm +${Math.round(settings.temperature * 100)}`
                      : `Cool ${Math.round(settings.temperature * 100)}`
                }
                min={-0.5}
                max={0.5}
                step={0.02}
                onChange={(temperature) => onPatch({ temperature }, true)}
              />
              <SliderRow
                label="Vignette"
                value={settings.vignette}
                display={`${Math.round(settings.vignette * 100)}%`}
                min={0}
                max={0.8}
                step={0.02}
                disabled={settings.backdrop === 'transparent'}
                onChange={(vignette) => onPatch({ vignette }, true)}
              />
            </CollapsibleContent>
          </Collapsible>

          <div className="pt-1">
            <Button size="sm" variant="ghost" className="w-full" onClick={onReset}>
              <RotateCcw aria-hidden="true" />
              Reset look to defaults
            </Button>
          </div>
        </div>
      </TabsContent>

      <TabsContent
        value="camera"
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3"
      >
        <div className="flex flex-col gap-3">
          <SectionTitle title="Lens & Framing" />
          <Field label="Projection">
            <SegmentedControl
              size="sm"
              aria-label="Camera projection"
              value={settings.projection}
              onValueChange={(v) => v && onPatch({ projection: v as 'isometric' | 'perspective' })}
              className="w-full"
            >
              <SegmentedControlItem value="isometric" className="flex-1">
                Isometric
              </SegmentedControlItem>
              <SegmentedControlItem value="perspective" className="flex-1">
                Perspective
              </SegmentedControlItem>
            </SegmentedControl>
          </Field>

          {settings.projection === 'perspective' && (
            <SliderRow
              label="Field of view"
              value={settings.fov}
              display={`${Math.round(settings.fov)}°`}
              min={20}
              max={90}
              step={1}
              onChange={(fov) => onPatch({ fov })}
            />
          )}

          <Field label="Aspect crop frame">
            <Select
              value={settings.aspect}
              onValueChange={(v) => onPatch({ aspect: v as AspectRatio })}
            >
              <SelectTrigger size="sm" aria-label="Aspect ratio">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="16:9">16:9 Widescreen</SelectItem>
                <SelectItem value="4:3">4:3 Classic</SelectItem>
                <SelectItem value="1:1">1:1 Square</SelectItem>
                <SelectItem value="9:16">9:16 Vertical / Shorts</SelectItem>
                <SelectItem value="free">Free (match viewport)</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Composition guide">
            <SegmentedControl
              size="sm"
              aria-label="Composition guide"
              value={settings.guides}
              onValueChange={(v) => v && onPatch({ guides: v as CompositionGuide })}
              className="w-full"
            >
              <SegmentedControlItem value="none" className="flex-1">
                Off
              </SegmentedControlItem>
              <SegmentedControlItem value="thirds" className="flex-1">
                Thirds
              </SegmentedControlItem>
              <SegmentedControlItem value="center" className="flex-1">
                Center
              </SegmentedControlItem>
            </SegmentedControl>
          </Field>
        </div>

        <div className="flex flex-col gap-3 border-t border-border-subtle pt-3">
          <SectionTitle title="Section & Layers" />
          {height > 1 && (
            <SliderRow
              label="Height cutaway"
              value={clipY ?? topY}
              display={clipY === null ? 'Full height' : `Y ≤ ${clipY}`}
              min={0}
              max={topY}
              step={1}
              onChange={(y) => onClipY(y >= topY ? null : y)}
            />
          )}
          {hasEdits && (
            <Field label="Include hand edits" orientation="horizontal">
              <Switch
                checked={settings.includeEdits}
                onCheckedChange={(includeEdits) => onPatch({ includeEdits })}
              />
            </Field>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-border-subtle pt-3">
          <SectionTitle
            title="Contact sheet angles"
            badge={
              <span className="font-mono text-2xs text-fg-muted tabular-nums">
                {settings.sheetViews.length} selected
              </span>
            }
          />
          <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
            {STUDIO_CAMERA_PRESETS.map((angle) => (
              <Field key={angle.id} label={angle.short} orientation="horizontal">
                <Checkbox
                  checked={settings.sheetViews.includes(angle.id)}
                  onCheckedChange={(on) => toggleAngle(angle.id, on === true)}
                />
              </Field>
            ))}
          </div>
          <Field label="Angle labels on sheet" orientation="horizontal">
            <Switch
              checked={settings.sheetLabels}
              onCheckedChange={(sheetLabels) => onPatch({ sheetLabels })}
            />
          </Field>
        </div>
      </TabsContent>

      <TabsContent
        value="export"
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3"
      >
        <div className="flex flex-col gap-3">
          <SectionTitle
            title="Output"
            badge={
              <span className="font-mono text-2xs text-fg-muted tabular-nums">
                {exportSize.width} × {exportSize.height}
              </span>
            }
          />

          <Field label="Image format">
            <SegmentedControl
              size="sm"
              aria-label="Image format"
              value={settings.format}
              onValueChange={(v) => v && onPatch({ format: v as RenderImageFormat })}
              className="w-full"
            >
              <SegmentedControlItem value="png" className="flex-1">
                PNG
              </SegmentedControlItem>
              <SegmentedControlItem value="webp" className="flex-1">
                WebP
              </SegmentedControlItem>
              <SegmentedControlItem value="jpeg" className="flex-1">
                JPEG
              </SegmentedControlItem>
            </SegmentedControl>
          </Field>

          {settings.format !== 'png' && (
            <SliderRow
              label="Compression quality"
              value={settings.quality}
              display={`${Math.round(settings.quality * 100)}%`}
              min={0.6}
              max={1}
              step={0.02}
              onChange={(quality) => onPatch({ quality })}
            />
          )}

          <Field label="Resolution">
            <Select
              value={settings.resolution}
              onValueChange={(v) => onPatch({ resolution: v as ResolutionPreset })}
            >
              <SelectTrigger size="sm" aria-label="Export resolution">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESOLUTION_OPTIONS.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Anti-aliasing (SSAA)">
            <SegmentedControl
              size="sm"
              aria-label="Supersampling"
              value={String(settings.ssaa)}
              onValueChange={(v) => v && onPatch({ ssaa: v === '2' ? 2 : 1 })}
              className="w-full"
            >
              <SegmentedControlItem value="1" className="flex-1">
                1× Fast
              </SegmentedControlItem>
              <SegmentedControlItem value="2" className="flex-1">
                2× Crisp
              </SegmentedControlItem>
            </SegmentedControl>
          </Field>

          <Field label="Tight auto-crop to build" orientation="horizontal">
            <Switch
              checked={settings.autoCrop}
              onCheckedChange={(autoCrop) => onPatch({ autoCrop })}
            />
          </Field>
        </div>

        <div className="flex flex-col gap-2 border-t border-border-subtle pt-3">
          <SectionTitle title="Export actions" />
          <Button variant="primary" disabled={busy} onClick={onSave}>
            <Download aria-hidden="true" />
            {settings.shotMode === 'sheet' ? 'Save contact sheet…' : 'Save image…'}
          </Button>
          <Button variant="outline" disabled={busy} onClick={onCopy}>
            <Copy aria-hidden="true" />
            Copy PNG to clipboard
          </Button>
          {settings.shotMode === 'sheet' && (
            <Button variant="outline" disabled={busy} onClick={onBatchSave}>
              <FolderDown aria-hidden="true" />
              Export {settings.sheetViews.length} angles to folder…
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-border-subtle pt-3">
          <SectionTitle title="Build artwork" />
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !canSaveToBuild}
            onClick={onSaveThumbnail}
          >
            <ImageIcon aria-hidden="true" />
            Set as Gallery thumbnail
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !canSaveToBuild}
            onClick={onSaveSheet}
          >
            <Layers aria-hidden="true" />
            Save as version render sheet
          </Button>
          <p className="text-xs text-fg-muted">
            Updates this version’s preview in the Gallery and Review screens without re-running the
            build script.
          </p>
        </div>
      </TabsContent>
    </Tabs>
  )
}
