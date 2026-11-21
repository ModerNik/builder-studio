import type { ReactElement } from 'react'
import { Button } from '@/shared/ui/primitives/button'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger
} from '@/shared/ui/primitives/drawer'
import { RadioGroup, RadioGroupItem } from '@/shared/ui/primitives/radio-group'
import { Field } from '@/shared/ui/primitives/field'
import { Guidance } from '../specimen'

export const meta = { group: 'Overlays', title: 'Drawer (bottom sheet)' }

export default function DrawerSection(): ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <Drawer>
        <DrawerTrigger asChild>
          <Button variant="outline" className="self-start">
            Open bottom sheet
          </Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>View mode</DrawerTitle>
            <DrawerDescription>Pick how the build is shown.</DrawerDescription>
          </DrawerHeader>
          <RadioGroup defaultValue="3d" aria-label="View mode" className="gap-3">
            {['3D', 'Preview', 'Compare', 'Highlight changes'].map((v) => (
              <Field key={v} label={v} orientation="horizontal">
                <RadioGroupItem value={v.toLowerCase()} />
              </Field>
            ))}
          </RadioGroup>
          <DrawerFooter>
            <Button>Apply</Button>
            <DrawerClose asChild>
              <Button variant="outline">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
      <Guidance>
        For phones and tablets. Built on Dialog (focus trap, Esc, focus return), with a grab-handle visual.
        Swipe-to-close is not built (no new dependency); a tap on the scrim or Cancel closes it.
      </Guidance>
    </div>
  )
}
