import type { ReactElement } from 'react'
import { Button } from '@/shared/ui/primitives/button'
import { Field } from '@/shared/ui/primitives/field'
import { NumberField } from '@/shared/ui/primitives/number-field'
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/shared/ui/primitives/popover'
import { Guidance, Specimen, Specimens } from '../specimen'

export const meta = { group: 'Overlays', title: 'Popover' }

export default function PopoverSection(): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <Specimens>
        <Specimen label="closed (click to open)">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">Grid size</Button>
            </PopoverTrigger>
            <PopoverContent className="flex flex-col gap-3">
              <p className="font-medium">Grid size</p>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Width">
                  <NumberField value={16} onValueChange={() => {}} min={1} unit="px" />
                </Field>
                <Field label="Depth">
                  <NumberField value={16} onValueChange={() => {}} min={1} unit="px" />
                </Field>
              </div>
              <PopoverClose asChild>
                <Button size="sm" className="self-end">
                  Apply
                </Button>
              </PopoverClose>
            </PopoverContent>
          </Popover>
        </Specimen>
        <Specimen label="text only, top">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost">What is a part?</Button>
            </PopoverTrigger>
            <PopoverContent side="top" className="w-64 text-sm text-fg-secondary">
              A part is a named group of blocks in build.py, such as the roof or the stair. Review picks
              target parts.
            </PopoverContent>
          </Popover>
        </Specimen>
      </Specimens>
      <Guidance>
        Popovers hold small, optional settings next to their trigger. Esc or an outside click closes them and
        focus returns to the trigger. Use a Dialog when the task needs the user’s full attention.
      </Guidance>
    </div>
  )
}
