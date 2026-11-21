import type { ReactElement } from 'react'
import { MINECRAFT_VERSIONS } from '@shared/minecraft'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/shared/ui/primitives/select'

export function MinecraftVersionSelect({
  value,
  onChange,
  label = 'Minecraft target',
  disabled = false,
  versions = MINECRAFT_VERSIONS,
  className = 'w-36'
}: {
  value: string
  onChange: (version: string) => void
  label?: string
  disabled?: boolean
  versions?: readonly string[]
  className?: string
}): ReactElement {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger aria-label={label} className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {[...versions].reverse().map((version) => (
          <SelectItem key={version} value={version}>
            {version}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
