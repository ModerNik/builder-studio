import type { ReactElement } from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/shared/ui/primitives/accordion'
import { LONG } from '../specimen'

export const meta = { group: 'Display', title: 'Accordion' }

export default function AccordionSection(): ReactElement {
  return (
    <div className="grid max-w-3xl gap-8 md:grid-cols-2">
      <Accordion type="single" collapsible defaultValue="a">
        <AccordionItem value="a">
          <AccordionTrigger>What does Draft do?</AccordionTrigger>
          <AccordionContent>Runs build.py in the engine and saves a new version you can compare.</AccordionContent>
        </AccordionItem>
        <AccordionItem value="b">
          <AccordionTrigger>{LONG}</AccordionTrigger>
          <AccordionContent>Long triggers wrap; the chevron stays at the end.</AccordionContent>
        </AccordionItem>
        <AccordionItem value="c" disabled>
          <AccordionTrigger>Disabled item</AccordionTrigger>
          <AccordionContent>Hidden</AccordionContent>
        </AccordionItem>
      </Accordion>
      <Accordion type="multiple" defaultValue={['x', 'y']} dir="rtl">
        <AccordionItem value="x">
          <AccordionTrigger>multiple, RTL: מגדל</AccordionTrigger>
          <AccordionContent>תוכן</AccordionContent>
        </AccordionItem>
        <AccordionItem value="y">
          <AccordionTrigger>Second open item</AccordionTrigger>
          <AccordionContent>Both stay open.</AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
