// Render Studio presets, settings schema, camera preset definitions and resolution helpers.
import type { RenderImageFormat } from '@shared/api'

export type PresetId =
  'vanilla' | 'golden-hour' | 'midday' | 'twilight' | 'architectural' | 'cutout' | 'custom'

export type BackdropMode = 'sky' | 'studio' | 'solid' | 'transparent'
export type DofMode = 'off' | 'tilt-shift' | 'focus'
export type ShotMode = 'single' | 'sheet'
export type AspectRatio = 'free' | '16:9' | '4:3' | '1:1' | '9:16'
export type CompositionGuide = 'none' | 'thirds' | 'center'
export type ResolutionPreset =
  '1280x720' | '1920x1080' | '2560x1440' | '3840x2160' | '1600x1600' | '1080x1920'

export type StudioCameraPreset =
  | 'iso_se'
  | 'iso_ne'
  | 'iso_nw'
  | 'iso_sw'
  | 'top'
  | 'eye_s'
  | 'elev_s'
  | 'elev_e'
  | 'elev_n'
  | 'elev_w'

export interface CameraPresetSpec {
  id: StudioCameraPreset
  label: string
  short: string
  mode: 'isometric' | 'perspective'
  pitch: number
  yaw: number
}

export const STUDIO_CAMERA_PRESETS: readonly CameraPresetSpec[] = [
  {
    id: 'iso_se',
    label: 'Southeast',
    short: 'SE',
    mode: 'isometric',
    pitch: 35.264,
    yaw: 45
  },
  {
    id: 'iso_ne',
    label: 'Northeast',
    short: 'NE',
    mode: 'isometric',
    pitch: 35.264,
    yaw: 135
  },
  {
    id: 'iso_nw',
    label: 'Northwest',
    short: 'NW',
    mode: 'isometric',
    pitch: 35.264,
    yaw: 225
  },
  {
    id: 'iso_sw',
    label: 'Southwest',
    short: 'SW',
    mode: 'isometric',
    pitch: 35.264,
    yaw: 315
  },
  { id: 'top', label: 'Top plan', short: 'Top', mode: 'isometric', pitch: 89.9, yaw: 0 },
  { id: 'eye_s', label: 'Eye level', short: 'Eye', mode: 'perspective', pitch: 10, yaw: 12 },
  { id: 'elev_s', label: 'Front (south)', short: 'Front', mode: 'isometric', pitch: 0.1, yaw: 0 },
  { id: 'elev_e', label: 'Right (east)', short: 'Right', mode: 'isometric', pitch: 0.1, yaw: 90 },
  { id: 'elev_n', label: 'Back (north)', short: 'Back', mode: 'isometric', pitch: 0.1, yaw: 180 },
  { id: 'elev_w', label: 'Left (west)', short: 'Left', mode: 'isometric', pitch: 0.1, yaw: 270 }
] as const

export const DEFAULT_SHEET_VIEWS: StudioCameraPreset[] = [
  'iso_ne',
  'iso_se',
  'iso_sw',
  'iso_nw',
  'top',
  'eye_s'
]

export interface LookPresetSettings {
  lightingMode: 'game' | 'sun' | 'flat'
  sunAzimuth: number
  sunElevation: number
  sunIntensity: number
  shadowMapSize: 2048 | 4096
  aoStrength: number
  aoRadius: number
  backdrop: BackdropMode
  bgColor: string
  groundShadow: boolean
  groundShadowOpacity: number
  fog: boolean
  fogDensity: number
  glass: 'blend' | 'opaque'
  waterSheen: number
  emissiveGlow: number
  emissiveLights: boolean
  bloomStrength: number
  bloomRadius: number
  dofMode: DofMode
  dofFocusX: number
  dofFocusY: number
  dofAperture: number
  toneMapping: 'linear' | 'aces'
  exposure: number
  contrast: number
  saturation: number
  temperature: number
  vignette: number
}

export interface StudioSettings extends LookPresetSettings {
  preset: PresetId
  shotMode: ShotMode
  projection: 'isometric' | 'perspective'
  fov: number
  aspect: AspectRatio
  guides: CompositionGuide
  includeEdits: boolean
  format: RenderImageFormat
  quality: number
  resolution: ResolutionPreset
  ssaa: 1 | 2
  autoCrop: boolean
  sheetViews: StudioCameraPreset[]
  sheetLabels: boolean
}

export interface RenderPresetDefinition {
  id: Exclude<PresetId, 'custom'>
  name: string
  description: string
  /** CSS gradient tokens for the preset swatch card (kept out of JSX hex literals). */
  swatch: string
  look: LookPresetSettings
}

export const RENDER_PRESETS: readonly RenderPresetDefinition[] = [
  {
    id: 'golden-hour',
    name: 'Golden Hour',
    description: 'Low warm sun, long soft shadows, glowing lanterns & ACES filmic grade',
    swatch: 'linear-gradient(155deg, #273766 0%, #c86d4d 55%, #f4b170 100%)',
    look: {
      lightingMode: 'sun',
      sunAzimuth: 132,
      sunElevation: 16,
      sunIntensity: 1.15,
      shadowMapSize: 4096,
      aoStrength: 1.15,
      aoRadius: 0.7,
      backdrop: 'sky',
      bgColor: '#27272a',
      groundShadow: true,
      groundShadowOpacity: 0.34,
      fog: true,
      fogDensity: 0.35,
      glass: 'blend',
      waterSheen: 0.85,
      emissiveGlow: 1.45,
      emissiveLights: true,
      bloomStrength: 0.42,
      bloomRadius: 0.55,
      dofMode: 'off',
      dofFocusX: 0.5,
      dofFocusY: 0.5,
      dofAperture: 0.35,
      toneMapping: 'aces',
      exposure: 1.06,
      contrast: 0.08,
      saturation: 0.1,
      temperature: 0.14,
      vignette: 0.22
    }
  },
  {
    id: 'midday',
    name: 'Midday Shaders',
    description: 'Crisp overhead sunlight, vivid sky dome, reflective water & rich AO',
    swatch: 'linear-gradient(155deg, #2b6fe8 0%, #7cb8ff 60%, #dceeff 100%)',
    look: {
      lightingMode: 'sun',
      sunAzimuth: 145,
      sunElevation: 52,
      sunIntensity: 1.2,
      shadowMapSize: 4096,
      aoStrength: 1.1,
      aoRadius: 0.65,
      backdrop: 'sky',
      bgColor: '#78a7ff',
      groundShadow: true,
      groundShadowOpacity: 0.28,
      fog: true,
      fogDensity: 0.22,
      glass: 'blend',
      waterSheen: 0.9,
      emissiveGlow: 0.65,
      emissiveLights: false,
      bloomStrength: 0.18,
      bloomRadius: 0.35,
      dofMode: 'off',
      dofFocusX: 0.5,
      dofFocusY: 0.5,
      dofAperture: 0.3,
      toneMapping: 'aces',
      exposure: 1.04,
      contrast: 0.06,
      saturation: 0.08,
      temperature: 0.02,
      vignette: 0.12
    }
  },
  {
    id: 'twilight',
    name: 'Twilight Night',
    description: 'Starlit indigo sky, cool moonlight & warm glowing lanterns with bloom',
    swatch: 'linear-gradient(155deg, #070d20 0%, #1a2d5c 62%, #e89b48 100%)',
    look: {
      lightingMode: 'sun',
      sunAzimuth: 220,
      sunElevation: -6,
      sunIntensity: 0.55,
      shadowMapSize: 4096,
      aoStrength: 1.25,
      aoRadius: 0.8,
      backdrop: 'sky',
      bgColor: '#0c1326',
      groundShadow: true,
      groundShadowOpacity: 0.45,
      fog: true,
      fogDensity: 0.3,
      glass: 'blend',
      waterSheen: 0.85,
      emissiveGlow: 2.15,
      emissiveLights: true,
      bloomStrength: 0.72,
      bloomRadius: 0.68,
      dofMode: 'off',
      dofFocusX: 0.5,
      dofFocusY: 0.5,
      dofAperture: 0.35,
      toneMapping: 'aces',
      exposure: 1.02,
      contrast: 0.12,
      saturation: 0.06,
      temperature: -0.1,
      vignette: 0.32
    }
  },
  {
    id: 'vanilla',
    name: 'Vanilla Game',
    description: 'Authentic Minecraft per-face shading and plains sky without cast shadows',
    swatch: 'linear-gradient(155deg, #6298ff 0%, #78a7ff 60%, #a9cbff 100%)',
    look: {
      lightingMode: 'game',
      sunAzimuth: 135,
      sunElevation: 45,
      sunIntensity: 1.0,
      shadowMapSize: 2048,
      aoStrength: 0.9,
      aoRadius: 0.4,
      backdrop: 'solid',
      bgColor: '#78a7ff',
      groundShadow: false,
      groundShadowOpacity: 0.25,
      fog: false,
      fogDensity: 0,
      glass: 'blend',
      waterSheen: 0,
      emissiveGlow: 0,
      emissiveLights: false,
      bloomStrength: 0,
      bloomRadius: 0.3,
      dofMode: 'off',
      dofFocusX: 0.5,
      dofFocusY: 0.5,
      dofAperture: 0,
      toneMapping: 'linear',
      exposure: 1.0,
      contrast: 0,
      saturation: 0,
      temperature: 0,
      vignette: 0
    }
  },
  {
    id: 'architectural',
    name: 'Architectural',
    description: 'Clean studio backdrop, soft sculpted sun & subtle diorama Tilt-Shift',
    swatch: 'linear-gradient(155deg, #323743 0%, #22262f 55%, #16181f 100%)',
    look: {
      lightingMode: 'sun',
      sunAzimuth: 120,
      sunElevation: 42,
      sunIntensity: 1.05,
      shadowMapSize: 4096,
      aoStrength: 1.25,
      aoRadius: 0.6,
      backdrop: 'studio',
      bgColor: '#232731',
      groundShadow: true,
      groundShadowOpacity: 0.42,
      fog: false,
      fogDensity: 0,
      glass: 'blend',
      waterSheen: 0.5,
      emissiveGlow: 1.1,
      emissiveLights: false,
      bloomStrength: 0.25,
      bloomRadius: 0.4,
      dofMode: 'tilt-shift',
      dofFocusX: 0.5,
      dofFocusY: 0.5,
      dofAperture: 0.32,
      toneMapping: 'aces',
      exposure: 1.02,
      contrast: 0.05,
      saturation: -0.04,
      temperature: 0,
      vignette: 0.16
    }
  },
  {
    id: 'cutout',
    name: 'Studio Cutout',
    description: 'Transparent PNG with soft grounded drop shadow, ready for docs & sharing',
    swatch: 'repeating-conic-gradient(#3b3f4a 0% 25%, #272a33 0% 50%) 50% / 12px 12px',
    look: {
      lightingMode: 'sun',
      sunAzimuth: 135,
      sunElevation: 48,
      sunIntensity: 1.12,
      shadowMapSize: 4096,
      aoStrength: 1.05,
      aoRadius: 0.55,
      backdrop: 'transparent',
      bgColor: '#27272a',
      groundShadow: true,
      groundShadowOpacity: 0.36,
      fog: false,
      fogDensity: 0,
      glass: 'blend',
      waterSheen: 0.6,
      emissiveGlow: 0.9,
      emissiveLights: false,
      bloomStrength: 0.18,
      bloomRadius: 0.35,
      dofMode: 'off',
      dofFocusX: 0.5,
      dofFocusY: 0.5,
      dofAperture: 0,
      toneMapping: 'aces',
      exposure: 1.04,
      contrast: 0.04,
      saturation: 0.04,
      temperature: 0,
      vignette: 0
    }
  }
] as const

export function getPreset(id: Exclude<PresetId, 'custom'>): RenderPresetDefinition {
  return RENDER_PRESETS.find((p) => p.id === id) ?? RENDER_PRESETS[0]
}

export function defaultStudioSettings(): StudioSettings {
  return {
    preset: 'golden-hour',
    ...RENDER_PRESETS[0].look,
    shotMode: 'single',
    projection: 'isometric',
    fov: 50,
    aspect: '16:9',
    guides: 'none',
    includeEdits: true,
    format: 'png',
    quality: 0.92,
    resolution: '1920x1080',
    ssaa: 2,
    autoCrop: false,
    sheetViews: [...DEFAULT_SHEET_VIEWS],
    sheetLabels: true
  }
}

export const RESOLUTION_OPTIONS: readonly {
  id: ResolutionPreset
  label: string
  width: number
  height: number
}[] = [
  { id: '1280x720', label: '720p (1280 × 720)', width: 1280, height: 720 },
  { id: '1920x1080', label: '1080p HD (1920 × 1080)', width: 1920, height: 1080 },
  { id: '2560x1440', label: '1440p QHD (2560 × 1440)', width: 2560, height: 1440 },
  { id: '3840x2160', label: '4K UHD (3840 × 2160)', width: 3840, height: 2160 },
  { id: '1600x1600', label: 'Square (1600 × 1600)', width: 1600, height: 1600 },
  { id: '1080x1920', label: 'Portrait (1080 × 1920)', width: 1080, height: 1920 }
] as const

/** Compute pixel dimensions for export, adapting height/width cleanly when an explicit aspect ratio is selected. */
export function resolveExportSize(
  resolution: ResolutionPreset,
  aspect: AspectRatio,
  stageAspect = 16 / 9
): { width: number; height: number } {
  const base = RESOLUTION_OPTIONS.find((r) => r.id === resolution) ?? RESOLUTION_OPTIONS[1]
  if (aspect === 'free') {
    const clamped = Math.max(0.4, Math.min(2.6, stageAspect || 16 / 9))
    const longEdge = Math.max(base.width, base.height)
    return clamped >= 1
      ? { width: longEdge, height: Math.max(64, Math.round(longEdge / clamped)) }
      : { width: Math.max(64, Math.round(longEdge * clamped)), height: longEdge }
  }
  const [aw, ah] = aspect.split(':').map(Number)
  const ratio = aw / ah
  const longEdge = Math.max(base.width, base.height)
  return ratio >= 1
    ? { width: longEdge, height: Math.max(64, Math.round(longEdge / ratio)) }
    : { width: Math.max(64, Math.round(longEdge * ratio)), height: longEdge }
}
