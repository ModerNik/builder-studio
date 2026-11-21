import type { ReactElement } from 'react'
import { ChevronDownIcon, MinusIcon, PlusIcon } from 'lucide-react'
import { Button } from '@/shared/ui/primitives/button'
import { ButtonGroup } from '@/shared/ui/primitives/button-group'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/shared/ui/primitives/dropdown-menu'
import { IconButton } from '@/shared/ui/primitives/icon-button'
import { Specimen, Specimens } from '../specimen'

export const meta = { group: 'Actions', title: 'Button group' }

export default function ButtonGroupSection(): ReactElement {
  return (
    <Specimens>
      <Specimen label="outline">
        <ButtonGroup aria-label="Version">
          <Button variant="outline">Previous</Button>
          <Button variant="outline">Current</Button>
          <Button variant="outline">Next</Button>
        </ButtonGroup>
      </Specimen>
      <Specimen label="split button">
        <ButtonGroup aria-label="Export">
          <Button>Export</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton label="More export options" variant="default" className="border-s border-s-accent-on-solid/25">
                <ChevronDownIcon />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Export .litematic</DropdownMenuItem>
              <DropdownMenuItem>Export .schem</DropdownMenuItem>
              <DropdownMenuItem>Export preview sheet</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </ButtonGroup>
      </Specimen>
      <Specimen label="icon buttons">
        <ButtonGroup aria-label="Zoom">
          <IconButton label="Zoom out" variant="outline">
            <MinusIcon />
          </IconButton>
          <Button variant="outline" className="font-mono tabular-nums">
            100%
          </Button>
          <IconButton label="Zoom in" variant="outline">
            <PlusIcon />
          </IconButton>
        </ButtonGroup>
      </Specimen>
      <Specimen label="vertical">
        <ButtonGroup orientation="vertical" aria-label="Layer">
          <Button variant="outline">Up</Button>
          <Button variant="outline">Down</Button>
        </ButtonGroup>
      </Specimen>
      <Specimen label="RTL">
        <div dir="rtl">
          <ButtonGroup aria-label="RTL group">
            <Button variant="outline">א</Button>
            <Button variant="outline">ב</Button>
            <Button variant="outline">ג</Button>
          </ButtonGroup>
        </div>
      </Specimen>
    </Specimens>
  )
}
