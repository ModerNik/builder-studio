// The Ruler's readout in the Edit tab (DESIGN › Tool options): its two ends, the blocks it spans and the
// distance between them, with Copy and Clear.
import { Fragment, type ReactElement } from 'react'
import { Check, Copy, X } from 'lucide-react'
import { useCopy } from '@/shared/ui/common/copy'
import { Button } from '@/shared/ui/primitives/button'
import { distanceOf, spanOf, type Measure } from '@/entities/viewer/model/ruler'

export function RulerReadout({
  measure,
  onClear
}: {
  measure: Measure | null
  onClear: () => void
}): ReactElement {
  const { copied, copy } = useCopy()
  if (!measure) return <p className="mt-2 text-sm text-fg-muted">Click two blocks to measure.</p>
  const [from, to] = [measure.from.join(' '), measure.to.join(' ')]
  const span = spanOf(measure).join(' × ')
  const distance = distanceOf(measure).toFixed(1)
  const rows: [string, string, boolean][] = [
    ['From', from, true],
    ['To', to, true],
    ['Blocks', span, false],
    ['Distance', distance, false]
  ]
  return (
    <div className="mt-2 flex flex-col gap-3">
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
        {rows.map(([label, value, mono]) => (
          <Fragment key={label}>
            <dt className="text-[0.8125rem] text-fg-secondary">{label}</dt>
            <dd className={mono ? 'truncate font-mono tabular-nums' : 'tabular-nums'}>{value}</dd>
          </Fragment>
        ))}
      </dl>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => copy(`From ${from} to ${to}: ${span} blocks, ${distance} apart`)}
        >
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button size="sm" variant="outline" onClick={onClear}>
          <X aria-hidden="true" /> Clear
        </Button>
      </div>
    </div>
  )
}
