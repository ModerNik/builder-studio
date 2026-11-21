import type { ReactElement } from 'react'
import { Button } from '@/shared/ui/primitives/button'
import { Field } from '@/shared/ui/primitives/field'
import { Input } from '@/shared/ui/primitives/input'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '@/shared/ui/primitives/sheet'
import { Switch } from '@/shared/ui/primitives/switch'
import { Guidance, Specimen, Specimens } from '../specimen'

export const meta = { group: 'Overlays', title: 'Sheet' }

const sides = ['end', 'start', 'top', 'bottom'] as const

export default function SheetSection(): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <Specimens>
        {sides.map((side) => (
          <Specimen key={side} label={side}>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline">Open {side}</Button>
              </SheetTrigger>
              <SheetContent side={side}>
                <SheetHeader>
                  <SheetTitle>Editor</SheetTitle>
                  <SheetDescription>On narrow windows the docks open as sheets.</SheetDescription>
                </SheetHeader>
                <Field label="Part name">
                  <Input defaultValue="roof" />
                </Field>
                <Field label="Show this part" orientation="horizontal">
                  <Switch defaultChecked />
                </Field>
                <SheetFooter>
                  <SheetClose asChild>
                    <Button variant="outline">Close</Button>
                  </SheetClose>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </Specimen>
        ))}
      </Specimens>
      <Guidance>
        Start and end follow the reading direction. Side sheets are the assistant dock’s width
        (372px) and leave 48px of the window visible. Motion is a 240ms fade with 4px of travel from
        the edge.
      </Guidance>
    </div>
  )
}
