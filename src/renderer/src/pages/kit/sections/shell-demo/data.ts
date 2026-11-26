import { Euler, MathUtils, Quaternion } from 'three'
import { Box, GitBranch, Images, Map as MapIcon, Rocket, ScanEye, ScrollText } from 'lucide-react'
import { viewAngles, type ViewName } from '@/entities/viewer/model/look'
import type { Orientation } from '@/entities/viewer/model/axis-gizmo'

export const SCREENS = [
  { id: 'workspace', label: 'Workspace', icon: Box, group: 'core' },
  {
    id: 'review',
    label: 'Review',
    icon: ScanEye,
    group: 'core',
    badge: 'dot' as const,
    badgeLabel: 'The agent asks for a review',
    badgeTone: 'attention' as const
  },
  {
    id: 'variants',
    label: 'Variants',
    icon: GitBranch,
    group: 'core',
    badge: 2,
    badgeLabel: '2 lanes need you',
    badgeTone: 'attention' as const
  },
  { id: 'export', label: 'Export', icon: Rocket, group: 'core' },
  { id: 'site', label: 'Location', icon: MapIcon, group: 'support' },
  {
    id: 'refs',
    label: 'Refs',
    icon: Images,
    group: 'support',
    badge: 4,
    badgeLabel: '4 references'
  },
  { id: 'log', label: 'Log', icon: ScrollText, group: 'support' }
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
