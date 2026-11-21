import type { ReactElement } from 'react'
import { CircleCheck } from 'lucide-react'
import { Button } from '@/shared/ui/primitives/button'
import { Input } from '@/shared/ui/primitives/input'
import { StatusBadge } from '@/shared/ui/status/StatusBadge'
import { SettingsPanel, SettingsRow } from '@/entities/settings/ui/Settings'
import { InlineNotice } from '@/shared/ui/feedback/Alert'
import { MinecraftVersionSelect } from '@/entities/settings/ui/MinecraftVersionSelect'
import { useAvailability } from '@/entities/availability/model/availability'
import { useDetected } from '@/entities/settings/model/detected'
import { DEFAULT_MINECRAFT_VERSION } from '@shared/minecraft'
import { StepHeader, type StepProps } from './parts'
import { useInstallations } from '@/entities/settings/model/detected'
import { checkTextures, pickFile, pickFolder } from '../model/setup'

type Key = 'schematics' | 'saves'

export function Minecraft({ form, patch, act, save }: StepProps): ReactElement {
  const detected = useDetected().data
  const installations = useInstallations()
  const available = installations.data ?? []
  const suggested = available[0]
  const version = form.minecraftVersion ?? suggested?.version ?? DEFAULT_MINECRAFT_VERSION
  const installed = available.find((item) => item.version === version)
  const paths = form.minecraftFiles?.[version] ?? {}
  const jar = paths.jar ?? (version === DEFAULT_MINECRAFT_VERSION ? form.jar : '')
  const pack = paths.pack ?? (version === DEFAULT_MINECRAFT_VERSION ? form.pack : '')
  const patchPath = (key: 'jar' | 'pack', value: string): void =>
    patch({ minecraftFiles: { ...form.minecraftFiles, [version]: { ...paths, [key]: value } } })
  const pickMinecraftFile = (key: 'jar' | 'pack'): void =>
    act(async () => {
      const path = await pickFile(key === 'jar' ? jar || installed?.jar || '' : pack)
      if (path) patchPath(key, path)
    })
  const pick = (key: Key, file: boolean): void =>
    act(async () => {
      const current = form[key] || (key === 'saves' ? (detected?.[key] ?? '') : '')
      const path = await (file ? pickFile(current) : pickFolder(current))
      if (path) patch({ [key]: path })
    })
  const row = (key: Key, title: string, label: string, empty: string): ReactElement => {
    const found = !form[key] && !!detected?.[key]
    const path = form[key] || detected?.[key]
    return (
      <SettingsRow
        title={
          <span className="flex flex-wrap items-center gap-2">
            {title}
            {found && (
              <StatusBadge tone="success" icon={CircleCheck}>
                {key === 'saves' ? 'Found automatically' : 'Default folder'}
              </StatusBadge>
            )}
          </span>
        }
        mono={!!path}
        detail={path ? <span className={found ? 'text-fg-muted' : 'text-fg'}>{path}</span> : empty}
      >
        <Button variant="outline" aria-label={`Change ${label}`} onClick={() => pick(key, false)}>
          {path ? 'Change…' : 'Choose…'}
        </Button>
      </SettingsRow>
    )
  }
  const availability = useAvailability()
  return (
    <div className="flex flex-col gap-6">
      <StepHeader eyebrow="Step 4 of 6" title="Connect Minecraft">
        Choose the default version for new projects. Builder Studio reads your game files for
        textures and models.
      </StepHeader>
      <SettingsPanel>
        <SettingsRow
          title="Default Minecraft target"
          detail={
            suggested?.version === version
              ? `Found Minecraft ${suggested.version} in an installed launcher.`
              : 'New projects start with this version.'
          }
        >
          <MinecraftVersionSelect
            value={version}
            onChange={(minecraftVersion) => patch({ minecraftVersion })}
          />
        </SettingsRow>
        <SettingsRow
          title={`Minecraft ${version} game files`}
          detail="Client jar for this version."
        >
          <Input
            aria-label={`Minecraft ${version} client jar path`}
            value={jar}
            placeholder={installed?.jar || 'Path to client jar'}
            className="w-64 max-w-full font-mono text-sm"
            spellCheck={false}
            onChange={(e) => patchPath('jar', e.target.value)}
          />
          <Button variant="outline" onClick={() => pickMinecraftFile('jar')}>
            {jar || installed?.jar ? 'Change…' : 'Choose client jar…'}
          </Button>
        </SettingsRow>
        <SettingsRow
          title="Texture pack"
          detail="Optional. Uses textures from the client jar when empty."
        >
          <Input
            aria-label={`${version} texture pack path`}
            value={pack}
            placeholder="Path to texture pack ZIP"
            className="w-64 max-w-full font-mono text-sm"
            spellCheck={false}
            onChange={(e) => patchPath('pack', e.target.value)}
          />
          <Button variant="outline" onClick={() => pickMinecraftFile('pack')}>
            {pack ? 'Change…' : 'Choose texture pack…'}
          </Button>
        </SettingsRow>
        {row('schematics', 'Save exported schematics to', 'export folder', 'Not chosen yet')}
        {row('saves', 'Worlds folder (optional)', 'worlds folder', 'Not chosen yet')}
      </SettingsPanel>
      <p className="text-sm text-fg-secondary">
        Textures are optional during setup. Add game files whenever you want the 3D view. Exports
        use your default folder unless you choose another; connecting a world is optional.
      </p>
      <Button
        variant="outline"
        className="self-start"
        onClick={() => act(() => checkTextures(save))}
      >
        Check textures
      </Button>
      {availability.data && (
        <InlineNotice tone={availability.data.requirements.pack.ok ? 'success' : 'warning'}>
          {availability.data.requirements.pack.ok
            ? `Minecraft ${version} textures are ready.`
            : `Minecraft ${version} textures are not set up yet. You can continue and configure them later for the 3D view.`}
        </InlineNotice>
      )}
    </div>
  )
}
