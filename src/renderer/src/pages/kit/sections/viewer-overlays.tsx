import { PartsProgress } from '@/entities/parts/ui/PartsProgress'
import { useState, type ReactElement } from 'react'
import { RotateCw } from 'lucide-react'
import {
  ViewerStage,
  ViewerStatusToast,
  ViewerToolbar,
  ViewerToolbarButton
} from '@/entities/viewer/ui/ViewerOverlay'
import { ViewerErrorCard, ViewerLoadingCard } from '@/entities/viewer/ui/ViewerCards'
import { AxisGizmo } from '@/entities/viewer/ui/AxisGizmo'
import { ClipHeightControl, PartsToolbar, type ColorBy } from '@/entities/viewer/ui/ViewerControls'
import { PinMarker } from '@/entities/viewer/ui/PinMarker'
import { ToolHud } from '@/widgets/block-editor/ui/ToolHud'
import { ToolRail } from '@/widgets/block-editor/ui/ToolRail'
import type { ToolId } from '@/entities/block-edit/model/edit'
import { Button } from '@/shared/ui/primitives/button'
import { BridgeSketch } from './shell-demo/WorkspaceCanvas'
import { anglesOf, orbit, orient } from './shell-demo/data'
import { Specimen } from './shell-demo/Specimen'

export const meta = { group: 'Viewer', title: 'Viewer overlays' }

export default function ViewerOverlaysDemo(): ReactElement {
  const [angles, setAngles] = useState(anglesOf('iso_se'))
  const [said, setSaid] = useState({ text: null as string | null, at: 0 })
  const [clip, setClip] = useState(5)
  const [colorBy, setColorBy] = useState<ColorBy>('blocks')
  const [isolate, setIsolate] = useState(false)
  const [selected, setSelected] = useState(0)
  const [tool, setTool] = useState<ToolId>('place')
  const [edits, setEdits] = useState({ made: 3, cursor: 2 })
  return (
    <div>
      <p className="mb-4 max-w-prose text-fg-secondary">
        Glass overlays over the 3D view. The toolbar keeps clear of the axis gizmo; under 560px the
        insets shrink. In a screen, [ and ] move the clip height; one control per screen registers
        them, so try them in the workbench above. Drag the gizmo to orbit, click a bubble to look
        from that side, and click it again for the opposite side. It is one tab stop: arrow keys
        move between the six bubbles, Enter turns the camera. Its letters show at 12px.
      </p>
      <Specimen
        label="Toolbar, axis gizmo, toast, parts and clip; below 560px the insets shrink"
        resizable
        className="h-[26.25rem] w-[56.25rem] p-0"
      >
        <ViewerStage aria-label="3D view">
          <BridgeSketch clip={clip} />
          <ViewerToolbar label="View">
            <span className="px-1.5 font-mono text-sm text-fg-secondary">stone_bridge_v4</span>
            <ViewerToolbarButton onClick={() => setSaid({ text: 'View reset', at: Date.now() })}>
              <RotateCw aria-hidden="true" />
              Reset
            </ViewerToolbarButton>
          </ViewerToolbar>
          <AxisGizmo
            orientation={orient(angles)}
            onViewChange={(v) => setAngles(anglesOf(v))}
            onOrbit={(yaw, pitch) => setAngles((a) => orbit(a, yaw, pitch))}
            onAnnounce={(text) => setSaid({ text, at: Date.now() })}
          />
          <ViewerStatusToast message={said.text} at={said.at} />
          <div className="absolute right-(--viewer-inset) bottom-(--viewer-inset) left-(--viewer-inset) z-floating flex flex-wrap items-end justify-between gap-2">
            <PartsToolbar
              colorBy={colorBy}
              onColorBy={setColorBy}
              isolate={isolate}
              onIsolate={setIsolate}
              selected={selected}
              onClear={() => setSelected(0)}
            />
            <Button size="sm" variant="outline" onClick={() => setSelected((n) => n + 1)}>
              Select a part
            </Button>
            <ClipHeightControl value={clip} min={0} max={7} onChange={setClip} shortcuts={false} />
          </div>
        </ViewerStage>
      </Specimen>
      <Specimen
        label="Clip height, vertical beside the viewer (Workspace A): readout on top, all layers at the top end"
        className="h-80 w-[30rem] max-w-full p-0"
      >
        <ViewerStage aria-label="3D view, vertical clip">
          <BridgeSketch clip={clip} />
          <div className="absolute top-(--viewer-inset) right-(--viewer-inset) bottom-(--viewer-inset) z-floating flex">
            <ClipHeightControl
              orientation="vertical"
              value={clip}
              min={0}
              max={7}
              onChange={setClip}
              shortcuts={false}
            />
          </div>
        </ViewerStage>
      </Specimen>
      <Specimen
        label="Tool rail: Undo and Redo, then the tools; the corner mark means variants. The top toolbar starts after the rail; the tool HUD sits in the bottom-start corner, under it."
        className="h-[32rem] w-[40rem] max-w-full p-0"
      >
        <ViewerStage aria-label="3D view with the tool rail">
          <BridgeSketch clip={7} />
          <ToolRail
            tool={tool}
            onTool={setTool}
            canUndo={edits.cursor > 0}
            canRedo={edits.cursor < edits.made}
            onUndo={() => setEdits((e) => ({ ...e, cursor: e.cursor - 1 }))}
            onRedo={() => setEdits((e) => ({ ...e, cursor: e.cursor + 1 }))}
          />
          <ToolHud
            label="Brush"
            summary="Sphere 5 · Add"
            keys={[
              { keys: ['-', '='], label: 'size' },
              { keys: ['Esc'], label: 'cancel' }
            ]}
          />
          <ViewerToolbar label="View">
            <span className="px-1.5 font-mono text-sm text-fg-secondary">stone_bridge_v4</span>
          </ViewerToolbar>
        </ViewerStage>
      </Specimen>
      <Specimen
        label="A short stage: the rail stops above the tool HUD and scrolls. Select shows the selected block."
        className="h-72 w-[40rem] max-w-full p-0"
      >
        <ViewerStage aria-label="Short 3D view with the tool rail">
          <BridgeSketch clip={7} />
          <ToolRail
            tool="select"
            onTool={() => {}}
            canUndo={false}
            canRedo={false}
            onUndo={() => {}}
            onRedo={() => {}}
          />
          <ToolHud
            label="Select"
            summary="12 4 7 · oak_stairs[facing=north,half=bottom]"
            keys={[{ keys: ['Del'], label: 'erase' }]}
          />
        </ViewerStage>
      </Specimen>
      <Specimen label="Parts generation: measured stage and unknown duration">
        <PartsProgress progress={{ stage: 'encoding', fraction: 0.42 }} />
        <PartsProgress progress={{ stage: 'reading', fraction: null }} />
      </Specimen>
      <div className="grid gap-x-4 lg:grid-cols-2">
        <Specimen label="Loading, with progress" className="h-56 p-0">
          <ViewerStage>
            <ViewerLoadingCard
              label="Loading stone_bridge_v4"
              value={0.62}
              progressLabel="62% of blocks"
            />
          </ViewerStage>
        </Specimen>
        <Specimen label="Loading, no progress yet" className="h-56 p-0">
          <ViewerStage>
            <ViewerLoadingCard label="Starting the engine" progressLabel="Starting" />
          </ViewerStage>
        </Specimen>
        <Specimen label="Error with details" className="h-64 p-0">
          <ViewerStage>
            <ViewerErrorCard
              title="This build could not be shown"
              details="KeyError: 'minecraft:spruce_fence' is not in the block palette (build.py, line 22)"
              actions={<Button size="sm">Try again</Button>}
            />
          </ViewerStage>
        </Specimen>
        <Specimen label="Pins: open, selected, resolved" className="h-64 p-0">
          <ViewerStage>
            <BridgeSketch />
            <PinMarker
              n={1}
              x="30%"
              y="40%"
              state="open"
              where="v4 · 4 6 0 · lantern"
              note="Keep this one on the corner post."
            />
            <PinMarker
              n={2}
              x="50%"
              y="55%"
              state="selected"
              where="v4 · 8 4 0 · spruce_fence"
              note="Railings should be a block taller."
            />
            <PinMarker
              n={3}
              x="70%"
              y="45%"
              state="resolved"
              where="v4_oak · 7 4 1 · oak_planks"
              note="Too bright against the bricks."
            />
          </ViewerStage>
        </Specimen>
      </div>
    </div>
  )
}
