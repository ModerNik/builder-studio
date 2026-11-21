import { Euler, MathUtils, Quaternion } from 'three'
import { viewAngles, type ViewName } from '@/entities/viewer/model/look'
import type { Orientation } from '@/entities/viewer/model/axis-gizmo'

export const SCREENS = [
  { id: 'workspace', label: 'Workspace' },
  {
    id: 'review',
    label: 'Review',
    badge: 'dot' as const,
    badgeLabel: 'The agent asks for a review',
    badgeTone: 'attention' as const
  },
  { id: 'log', label: 'Design log' },
  { id: 'export', label: 'Export' },
  { id: 'site', label: 'Build location' },
  { id: 'refs', label: 'References', badge: 4, badgeLabel: '4 references' },
  {
    id: 'variants',
    label: 'Variants',
    badge: 2,
    badgeLabel: '2 lanes need you',
    badgeTone: 'attention' as const
  }
]

/** A stand-in camera for the kit's gizmos, in degrees. */
export type Angles = { pitch: number; yaw: number }
export const anglesOf = (view: ViewName): Angles =>
  view === 'orbit' ? { pitch: 30, yaw: 45 } : viewAngles(view)
export const orient = ({ pitch, yaw }: Angles): Orientation =>
  new Quaternion()
    .setFromEuler(new Euler(MathUtils.degToRad(-pitch), MathUtils.degToRad(yaw), 0, 'YXZ'))
    .toArray() as Orientation
/** The angles after a gizmo drag, turned as CameraManager.orbitBy turns the camera. */
export const orbit = (a: Angles, yaw: number, pitch: number): Angles => ({
  yaw: a.yaw - MathUtils.radToDeg(yaw),
  pitch: MathUtils.clamp(a.pitch + MathUtils.radToDeg(pitch), -89, 89)
})
