import { useMemo, useState, type ReactElement } from 'react'
import { WorldMapViewport } from '@/entities/world-map/ui/WorldMapViewport'
import { createSyntheticWorldSource } from '@/entities/world-map/lib/synthetic-source'
import type {
  Box2D,
  CameraMode,
  LightingMode,
  PlacementMode,
  RotationDeg,
  Vec3
} from '@/entities/world-map/model/types'
import { nextRotation } from '@/entities/world-map/model/placement'
import { SegmentedControl, SegmentedControlItem } from '@/shared/ui/primitives/toggle-group'
import { Slider } from '@/shared/ui/primitives/slider'
import { Specimen } from './shell-demo/Specimen'

export const meta = { group: 'Viewer', title: 'Map selection' }

export default function MapSelectionDemo(): ReactElement {
  const source = useMemo(() => createSyntheticWorldSource(), [])
  const [cameraMode, setCameraMode] = useState<CameraMode>('3d')
  const [lighting, setLighting] = useState<LightingMode>('sun')
  const [mode, setMode] = useState<PlacementMode>('area')
  const [areaBox, setAreaBox] = useState<Box2D>([-20, -16, 15, 19])
  const [origin, setOrigin] = useState<Vec3>([-8, 69, -8])
  const [rotation, setRotation] = useState<RotationDeg>(0)
  const [margin, setMargin] = useState(16)

  return (
    <div className="space-y-4">
      <p className="max-w-prose text-fg-secondary">
        Interactive BlueMap-style 3D world map with dual-LOD streaming (horizon terrain + close-up
        voxels). Drag to orbit, right-drag to pan, scroll to zoom, or press 1/2/3 for 3D, Isometric
        and 2D views. In Area mode, click terrain to move the box, drag corner handles to resize, or
        Shift-drag to draw a new area.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          size="sm"
          aria-label="Camera mode"
          value={cameraMode}
          onValueChange={(v) => v && setCameraMode(v as CameraMode)}
        >
          <SegmentedControlItem value="3d">3D</SegmentedControlItem>
          <SegmentedControlItem value="iso">Iso</SegmentedControlItem>
          <SegmentedControlItem value="top">2D</SegmentedControlItem>
        </SegmentedControl>
        <SegmentedControl
          size="sm"
          aria-label="Placement mode"
          value={mode}
          onValueChange={(v) => v && setMode(v as PlacementMode)}
        >
          <SegmentedControlItem value="area">Scout terrain</SegmentedControlItem>
          <SegmentedControlItem value="build">Place build</SegmentedControlItem>
        </SegmentedControl>
        <SegmentedControl
          size="sm"
          aria-label="Lighting"
          value={lighting}
          onValueChange={(v) => v && setLighting(v as LightingMode)}
        >
          <SegmentedControlItem value="sun">Sun</SegmentedControlItem>
          <SegmentedControlItem value="game">Game</SegmentedControlItem>
        </SegmentedControl>
      </div>
      <Specimen label="Interactive 3D world map" resizable className="h-[28rem] w-[48rem] p-0">
        <WorldMapViewport
          source={source}
          cameraMode={cameraMode}
          onCameraModeChange={setCameraMode}
          lighting={lighting}
          mode={mode}
          areaBox={areaBox}
          onAreaBoxChange={setAreaBox}
          origin={origin}
          onOriginChange={setOrigin}
          rotation={rotation}
          onRotate={(d) => setRotation((r) => nextRotation(r, d))}
          margin={margin}
        />
      </Specimen>
      <div className="flex max-w-sm items-center gap-3">
        <span className="shrink-0 text-sm text-fg-secondary">Margin</span>
        <Slider
          aria-label="Margin"
          min={0}
          max={48}
          step={4}
          value={[margin]}
          onValueChange={([v]) => setMargin(v)}
          showValue
          formatValue={(v) => `${v} blk`}
        />
      </div>
    </div>
  )
}
