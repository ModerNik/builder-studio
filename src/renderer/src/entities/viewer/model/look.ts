// Camera presets for the live view; the look itself lives in the renderer module, shared with the engine.
export {
  applyLook,
  DEFAULT_LOOK,
  type Look,
  type LookOptions,
  type Scene
} from '../lib/render/look'

/** Camera presets, as tools/render/render.py VIEWS. yaw 0 = +z, 90 = +x, 180 = -z, 270 = -x. */
export const VIEWS = {
  iso_se: { pitch: 35.264, yaw: 45 },
  iso_ne: { pitch: 35.264, yaw: 135 },
  iso_nw: { pitch: 35.264, yaw: 225 },
  iso_sw: { pitch: 35.264, yaw: 315 },
  top: { pitch: 89.9, yaw: 0 },
  elev_s: { pitch: 0.1, yaw: 0 },
  elev_e: { pitch: 0.1, yaw: 90 },
  elev_n: { pitch: 0.1, yaw: 180 },
  elev_w: { pitch: 0.1, yaw: 270 }
} as const
/** The other camera views (axis gizmo, Camera views menu): live views only, never rendered to sheets. Negative pitch looks up. */
export const CUBE_VIEWS = {
  bottom: { pitch: -89.9, yaw: 0 },
  under_se: { pitch: -35.264, yaw: 45 },
  under_ne: { pitch: -35.264, yaw: 135 },
  under_nw: { pitch: -35.264, yaw: 225 },
  under_sw: { pitch: -35.264, yaw: 315 },
  top_s: { pitch: 45, yaw: 0 },
  top_e: { pitch: 45, yaw: 90 },
  top_n: { pitch: 45, yaw: 180 },
  top_w: { pitch: 45, yaw: 270 },
  elev_se: { pitch: 0.1, yaw: 45 },
  elev_ne: { pitch: 0.1, yaw: 135 },
  elev_nw: { pitch: 0.1, yaw: 225 },
  elev_sw: { pitch: 0.1, yaw: 315 },
  bottom_s: { pitch: -45, yaw: 0 },
  bottom_e: { pitch: -45, yaw: 90 },
  bottom_n: { pitch: -45, yaw: 180 },
  bottom_w: { pitch: -45, yaw: 270 }
} as const
export type ViewName = keyof typeof VIEWS | keyof typeof CUBE_VIEWS | 'orbit'
export const viewAngles = (view: Exclude<ViewName, 'orbit'>): { pitch: number; yaw: number } =>
  view in VIEWS ? VIEWS[view as keyof typeof VIEWS] : CUBE_VIEWS[view as keyof typeof CUBE_VIEWS]
