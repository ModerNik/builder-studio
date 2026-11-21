import type { ReactElement } from 'react'
import { Field, Fieldset } from '@/shared/ui/primitives/field'
import { NumberField } from '@/shared/ui/primitives/number-field'
import { RadioGroup, RadioGroupItem } from '@/shared/ui/primitives/radio-group'

interface Props {
  position: [number, number, number]
  onPositionChange: (position: [number, number, number]) => void
  overlaps: { owner: string; label: string; count: number }[]
  replace: string[]
  onReplaceChange: (replace: string[]) => void
  checking?: boolean
  disabled?: boolean
}

const axes = [
  ['X', 'text-axis-x'],
  ['Y', 'text-axis-y'],
  ['Z', 'text-axis-z']
] as const

export function SchematicPlacementControls({
  position,
  onPositionChange,
  overlaps,
  replace,
  onReplaceChange,
  checking,
  disabled
}: Props): ReactElement {
  return (
    <div className="grid gap-4">
      <Fieldset legend="Position in blocks">
        <div className="grid grid-cols-3 gap-3">
          {axes.map(([axis, color], i) => (
            <Field key={axis} label={<span className={color}>{axis}</span>}>
              <NumberField
                value={position[i]}
                min={-2147483648}
                max={2147483647}
                disabled={disabled}
                onValueChange={(value) => {
                  if (value === null || !Number.isSafeInteger(value)) return
                  const next: Props['position'] = [...position]
                  next[i] = value
                  onPositionChange(next)
                }}
              />
            </Field>
          ))}
        </div>
      </Fieldset>
      <Fieldset legend="Overlapping blocks">
        <p role="status" className="text-sm text-fg-secondary empty:hidden">
          {checking ? 'Checking overlaps…' : overlaps.length === 0 ? 'No overlaps.' : ''}
        </p>
        {!checking &&
          overlaps.map(({ owner, label, count }) => (
            <div key={owner} className="grid gap-1.5 border-t border-border-subtle pt-2">
              <p className="min-w-0 wrap-anywhere text-sm">
                {label}{' '}
                <span className="tabular-nums text-fg-secondary">
                  ({count.toLocaleString()} {count === 1 ? 'block' : 'blocks'})
                </span>
              </p>
              <RadioGroup
                aria-label={`Overlapping blocks in ${label}`}
                className="flex flex-wrap gap-x-4 gap-y-1"
                value={replace.includes(owner) ? 'replace' : 'keep'}
                disabled={disabled}
                onValueChange={(choice) =>
                  onReplaceChange(
                    choice === 'replace'
                      ? [...replace, owner]
                      : replace.filter((selected) => selected !== owner)
                  )
                }
              >
                <Field label="Keep existing" orientation="horizontal">
                  <RadioGroupItem value="keep" />
                </Field>
                <Field label="Replace overlapping blocks" orientation="horizontal">
                  <RadioGroupItem value="replace" />
                </Field>
              </RadioGroup>
            </div>
          ))}
      </Fieldset>
    </div>
  )
}
