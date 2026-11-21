// Transform's controls in the Edit tab (DESIGN › Tool options): the selection, Mode, Turn, Flip, the offset,
// then Cancel and Apply.
import type { ReactElement } from 'react'
import { FlipHorizontal2, RotateCcw, RotateCw } from 'lucide-react'
import { Button } from '@/shared/ui/primitives/button'
import { Shortcut } from '@/shared/ui/primitives/kbd'
import { MAX_CELLS } from '@/entities/block-edit/model/edit'
import { Choice, Hint, Row, Rows } from '@/entities/block-edit/ui/OptionRows'
import { moved, type TransformOptions, type TransformState } from '../model/transform'

export function TransformPanel({
  options,
  onChange,
  transform
}: {
  options: TransformOptions
  onChange: (patch: Partial<TransformOptions>) => void
  /** The selection and what is waiting to be applied. */
  transform?: TransformState
}): ReactElement {
  if (!transform?.size)
    return <p className="mt-2 text-sm text-fg-muted">Select a box first: S, then Shift-click.</p>
  const { size, blocks, moves } = transform
  const dirty = moved(moves)
  return (
    <Rows>
      <p className="col-span-2 text-sm tabular-nums @max-[22rem]/options:col-span-1">
        {size.join(' × ')} box
        {blocks !== null && ` · ${blocks.toLocaleString()} block${blocks === 1 ? '' : 's'}`}
      </p>
      {blocks === null ? (
        <Hint>Transform takes up to {MAX_CELLS.toLocaleString()} cells. Select a smaller box.</Hint>
      ) : (
        <>
          <Row label="Mode">
            {(id) => (
              <Choice
                id={id}
                value={options.mode}
                items={[
                  ['move', 'Move'],
                  ['copy', 'Copy']
                ]}
                onChange={(mode) => onChange({ mode })}
              />
            )}
          </Row>
          <Row label="Turn">
            {(id) => (
              <div role="group" aria-labelledby={id} className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => transform.onTurn(-1)}>
                  <RotateCcw aria-label="Anticlockwise" /> <Shortcut keys="Q" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => transform.onTurn(1)}>
                  <RotateCw aria-label="Clockwise" /> <Shortcut keys="R" />
                </Button>
              </div>
            )}
          </Row>
          <Row label="Flip">
            {(id) => (
              <div role="group" aria-labelledby={id} className="flex flex-wrap gap-2">
                {(['X', 'Y', 'Z'] as const).map((axis, i) => (
                  <Button
                    key={axis}
                    size="sm"
                    variant="outline"
                    aria-label={`Flip across ${axis}`}
                    onClick={() => transform.onFlip(i as 0 | 1 | 2)}
                  >
                    <FlipHorizontal2
                      aria-hidden="true"
                      className={i === 1 ? 'rotate-90' : undefined}
                    />
                    {axis}
                  </Button>
                ))}
              </div>
            )}
          </Row>
          <Row label="Offset">
            {() => <span className="font-mono text-sm tabular-nums">{moves.offset.join(' ')}</span>}
          </Row>
          <Hint>
            Drag the arrows to move a block at a time and the ring to turn. Air in the box is left
            out, so the blocks land among what is there; Move clears where they were.
          </Hint>
          <div className="col-span-2 flex flex-wrap justify-end gap-2 @max-[22rem]/options:col-span-1">
            <Button size="sm" variant="outline" disabled={!dirty} onClick={transform.onCancel}>
              Cancel <Shortcut keys="Escape" />
            </Button>
            <Button size="sm" disabled={!dirty} onClick={transform.onApply}>
              Apply <Shortcut keys="Enter" />
            </Button>
          </div>
        </>
      )}
    </Rows>
  )
}
