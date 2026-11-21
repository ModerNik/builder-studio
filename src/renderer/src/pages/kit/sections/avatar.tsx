import type { ReactElement } from 'react'
import { BotIcon } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/primitives/avatar'
import { Specimen, Specimens } from '../specimen'

export const meta = { group: 'Display', title: 'Avatar' }

export default function AvatarSection(): ReactElement {
  return (
    <Specimens>
      <Specimen label="initials sm / default / lg">
        <div className="flex items-center gap-2">
          <Avatar size="sm">
            <AvatarFallback>ab</AvatarFallback>
          </Avatar>
          <Avatar>
            <AvatarFallback>ab</AvatarFallback>
          </Avatar>
          <Avatar size="lg">
            <AvatarFallback>ab</AvatarFallback>
          </Avatar>
        </div>
      </Specimen>
      <Specimen label="agent icon">
        <Avatar>
          <AvatarFallback className="bg-accent-subtle text-accent-text">
            <BotIcon aria-label="Assistant" />
          </AvatarFallback>
        </Avatar>
      </Specimen>
      <Specimen label="broken image falls back">
        <Avatar>
          <AvatarImage src="file:///missing.png" alt="Builder" />
          <AvatarFallback>bs</AvatarFallback>
        </Avatar>
      </Specimen>
    </Specimens>
  )
}
