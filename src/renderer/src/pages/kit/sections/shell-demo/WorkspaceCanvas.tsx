// Demo screen for the kit's shell previews: the viewer overlay kit on a stand-in for the 3D view.
import { useState, type ReactElement } from 'react'
import { Sparkles } from 'lucide-react'
import { anglesOf, orbit, orient } from './data'
import {
  ViewerSegmented,
  ViewerStage,
  ViewerStatusToast,
  ViewerToolbar,
  ViewerToolbarButton,
  ViewerToolbarSeparator
} from '@/entities/viewer/ui/ViewerOverlay'
import { AxisGizmo } from '@/entities/viewer/ui/AxisGizmo'
import { ClipHeightControl, PartsToolbar, type ColorBy } from '@/entities/viewer/ui/ViewerControls'
import { PinMarker } from '@/entities/viewer/ui/PinMarker'

/** A stone bridge in side elevation, drawn as blocks: a stand-in for the 3D view. */
export function BridgeSketch({ clip = 99 }: { clip?: number }): ReactElement {
  const blocks: [number, number, string][] = []
  for (let x = 0; x < 16; x++) {
    const arch = x >= 4 && x <= 11
    const top = arch ? 4 - Math.round(Math.abs(x - 7.5) / 2) : 0
    for (let y = 0; y < 5; y++)
      if (!arch || y >= top)
        blocks.push([x, y, y === 4 ? 'fill-deepslate-500' : 'fill-deepslate-600'])
    if (x % 4 === 0) blocks.push([x, 5, 'fill-deepslate-700'], [x, 6, 'fill-cat-4'])
  }
  return (
    <svg
      viewBox="-1 -1 18 9"
      aria-hidden="true"
      className="absolute inset-x-[12%] top-1/2 w-[76%] -translate-y-1/2"
    >
      {blocks
        .filter(([, y]) => y < clip)
        .map(([x, y, fill]) => (
          <rect key={`${x}:${y}`} x={x} y={6 - y} width={0.96} height={0.96} className={fill} />
        ))}
    </svg>
  )
}

export function WorkspaceCanvas({
  screen,
  build,
  searched
}: {
  screen: string
  build: string
  searched: number
}): ReactElement {
  const [mode, setMode] = useState<'3d' | 'preview' | 'compare'>('3d')
  const [angles, setAngles] = useState(anglesOf('iso_se'))
  const [said, setSaid] = useState<{ text: string | null; at: number }>({ text: null, at: 0 })
  const [clip, setClip] = useState(7)
  const [colorBy, setColorBy] = useState<ColorBy>('parts')
  const [isolate, setIsolate] = useState(false)
  const [selected, setSelected] = useState(1)
  const announce = (text: string): void => setSaid({ text, at: Date.now() })
  return (
    <div className="flex h-full flex-col">
      <h1 className="sr-only">
        {screen === 'review' ? 'Review' : 'Workspace'}: {build}
      </h1>
      <ViewerStage aria-label="3D view">
        <BridgeSketch clip={clip} />
        <ViewerToolbar label="View">
          <ViewerSegmented
            label="View mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: '3d', label: '3D', keys: '1' },
              { value: 'preview', label: 'Preview', keys: '2' },
              { value: 'compare', label: 'Compare', keys: '3' }
            ]}
          />
          <ViewerToolbarSeparator />
          <span className="truncate px-1.5 font-mono text-xs text-fg-secondary">{build}_v3</span>
          <ViewerToolbarButton className="ml-auto bg-accent-solid text-accent-on-solid hover:bg-accent-solid-hover hover:text-accent-on-solid">
            <Sparkles aria-hidden="true" />
            Generate draft
          </ViewerToolbarButton>
        </ViewerToolbar>
        <AxisGizmo
          orientation={orient(angles)}
          onViewChange={(v) => setAngles(anglesOf(v))}
          onOrbit={(yaw, pitch) => setAngles((a) => orbit(a, yaw, pitch))}
          onAnnounce={announce}
        />
        <ViewerStatusToast
          message={searched ? (said.text ?? 'Command palette (Ctrl K)') : said.text}
          at={said.at || searched}
        />
        {screen === 'review' && (
          <>
            <PinMarker
              n={1}
              x="38%"
              y="40%"
              state="open"
              where="v4 · 4 6 0 · lantern"
              note="Keep this one on the corner post."
            />
            <PinMarker
              n={2}
              x="62%"
              y="58%"
              state="resolved"
              where="v4_oak · 7 4 1 · oak_planks"
              note="Too bright against the bricks."
            />
          </>
        )}
        <div className="absolute right-(--viewer-inset) bottom-(--viewer-inset) left-(--viewer-inset) z-floating flex flex-wrap items-end justify-between gap-2">
          <PartsToolbar
            colorBy={colorBy}
            onColorBy={setColorBy}
            isolate={isolate}
            onIsolate={setIsolate}
            selected={selected}
            onClear={() => setSelected(0)}
          />
          <ClipHeightControl value={clip} min={0} max={7} onChange={setClip} />
        </div>
      </ViewerStage>
    </div>
  )
}
