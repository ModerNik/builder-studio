// Settings › Minecraft: the default target, per-version game files and game folders.
import { useState, type ReactElement } from 'react'
import { CircleCheck, CircleDashed, TriangleAlert } from 'lucide-react'
import { Button } from '@/shared/ui/primitives/button'
import { Field } from '@/shared/ui/primitives/field'
import { Input } from '@/shared/ui/primitives/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/shared/ui/primitives/select'
import { StatusBadge } from '@/shared/ui/status/StatusBadge'
import { SettingsPanel, SettingsRow } from '@/entities/settings/ui/Settings'
import { MinecraftVersionSelect } from '@/entities/settings/ui/MinecraftVersionSelect'
import { useAvailability } from '@/entities/availability/model/availability'
import type { Settings } from '@shared/api'
import { DEFAULT_MINECRAFT_VERSION, MINECRAFT_VERSIONS } from '@shared/minecraft'
import { SettingInput } from './bits'
import { useLocations, useMissingPaths, useSaveSettings } from '@/entities/settings/model/save'
import { useInstallations } from '@/entities/settings/model/detected'
import { refreshAvailability } from '../model/minecraft'
import { pickPath } from '../model/pick'

type Badge = 'ready' | 'optional' | 'needed'
const BADGE: Record<Badge, [tone: 'success' | 'warning' | 'neutral', text: string]> = {
  ready: ['success', 'Ready'],
  optional: ['neutral', 'Optional'],
  needed: ['warning', 'Needed for Export']
}
const ICON = { success: CircleCheck, warning: TriangleAlert, neutral: CircleDashed }

function VersionPath({
  version,
  kind,
  saved,
  detected,
  settings
}: {
  version: string
  kind: 'jar' | 'pack'
  saved: string
  detected: string
  settings: Settings
}): ReactElement {
  const [value, setValue] = useState(saved)
  const save = useSaveSettings()
  const label = kind === 'jar' ? 'Client jar' : 'Texture pack'
  const path = value || detected
  const write = (next: string): void => {
    setValue(next)
    const files = {
      ...settings.minecraftFiles,
      [version]: { ...settings.minecraftFiles?.[version], [kind]: next }
    }
    save.mutate({ minecraftFiles: files })
  }
  return (
    <Field
      label={label}
      hint={
        kind === 'jar'
          ? 'Used to inspect this version’s blocks.'
          : 'Overrides the client jar textures.'
      }
    >
      <div className="flex min-w-0 gap-2">
        <Input
          value={value}
          placeholder={detected || 'Not found automatically'}
          className="min-w-0 flex-1 font-mono text-sm"
          spellCheck={false}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => value !== saved && write(value.trim())}
          onKeyDown={(e) => e.key === 'Enter' && write(value.trim())}
        />
        <Button
          variant="outline"
          aria-label={`Browse for ${version} ${label.toLowerCase()}`}
          onClick={() => void pickPath('file', path).then((picked) => picked && write(picked))}
        >
          Browse…
        </Button>
      </div>
      {save.error && (
        <p role="alert" className="text-sm text-danger-text">
          {String(save.error)}
        </p>
      )}
    </Field>
  )
}

export function Minecraft({ settings }: { settings: Settings }): ReactElement {
  const requirements = useAvailability().data?.requirements
  const found = useLocations()
  const missing = useMissingPaths()
  const save = useSaveSettings()
  const installations = useInstallations()
  const target = settings.minecraftVersion ?? DEFAULT_MINECRAFT_VERSION
  const installed = installations.data ?? []
  const configured = settings.minecraftFiles ?? {}
  const versions = [
    ...new Set([target, ...Object.keys(configured), ...installed.map((i) => i.version)])
  ].sort((a, b) => MINECRAFT_VERSIONS.indexOf(b) - MINECRAFT_VERSIONS.indexOf(a))
  const [addVersion, setAddVersion] = useState('')
  const addable = MINECRAFT_VERSIONS.filter((version) => !versions.includes(version))
  const fields: {
    key: 'schematics' | 'saves'
    label: string
    help: string
    browse: 'folder'
    badge: Badge
    empty?: string
  }[] = [
    {
      key: 'schematics',
      label: 'Exported schematics folder',
      help: 'Where Export copies finished builds. Defaults to your user data; choose a Litematica folder if you prefer.',
      browse: 'folder',
      badge: requirements?.export.ok ? 'ready' : 'needed',
      empty: 'Use the default export folder'
    },
    {
      key: 'saves',
      label: 'Worlds folder',
      help: 'Lets you place a build straight into a world.',
      browse: 'folder',
      badge: 'optional'
    }
  ]
  return (
    <div className="flex flex-col gap-6">
      <SettingsPanel title="Minecraft target and files">
        <SettingsRow
          title="Default Minecraft target"
          detail="Used for new builds and Labs. Existing builds keep their own target."
        >
          <MinecraftVersionSelect
            value={target}
            onChange={(minecraftVersion) => {
              save.mutate({ minecraftVersion })
              refreshAvailability()
            }}
          />
        </SettingsRow>
        {versions.map((version) => {
          const auto = installed.find((item) => item.version === version)?.jar ?? ''
          // the single legacy jar/pack belongs to 26.3, as in resolveLocations (src/main/app/locations.ts)
          const legacy = version === DEFAULT_MINECRAFT_VERSION
          const savedJar = configured[version]?.jar ?? (legacy ? settings.jar : '')
          const savedPack = configured[version]?.pack ?? (legacy ? settings.pack : '')
          return (
            <div key={version} className="flex flex-col gap-4 border-t border-border-subtle p-4">
              <h3 className="font-medium text-fg">Minecraft {version}</h3>
              <VersionPath
                version={version}
                kind="jar"
                saved={savedJar}
                detected={auto}
                settings={settings}
              />
              <VersionPath
                version={version}
                kind="pack"
                saved={savedPack}
                detected=""
                settings={settings}
              />
            </div>
          )
        })}
        {addable.length > 0 && (
          <SettingsRow
            title="Add game files for another version"
            detail="Set a client jar or texture pack for a version not listed above."
          >
            <Select value={addVersion} onValueChange={setAddVersion}>
              <SelectTrigger aria-label="Version to add" className="w-36">
                <SelectValue placeholder="Choose version" />
              </SelectTrigger>
              <SelectContent>
                {[...addable].reverse().map((version) => (
                  <SelectItem key={version} value={version}>
                    {version}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              disabled={!addVersion}
              onClick={() => {
                if (addVersion) {
                  save.mutate({ minecraftFiles: { ...configured, [addVersion]: {} } })
                  setAddVersion('')
                }
              }}
            >
              Add version
            </Button>
          </SettingsRow>
        )}
      </SettingsPanel>
      <SettingsPanel title="Game folders">
        {fields.map((f) => {
          const [tone, text] = BADGE[f.badge]
          return (
            <div key={f.key} className="p-4">
              <Field
                id={`setting-${f.key}`}
                label={
                  <span className="flex flex-wrap items-center gap-2">
                    {f.label}
                    <StatusBadge tone={tone} icon={ICON[tone]}>
                      {text}
                    </StatusBadge>
                  </span>
                }
                hint={f.help}
                error={
                  settings[f.key] && missing.has(f.key)
                    ? 'Nothing is at this path. Check it, or empty the field to use what Builder Studio finds.'
                    : undefined
                }
              >
                <SettingInput
                  setting={f.key}
                  value={settings[f.key]}
                  placeholder={found[f.key] || f.empty}
                  browse={f.browse}
                  label={f.label}
                />
              </Field>
            </div>
          )
        })}
      </SettingsPanel>
    </div>
  )
}
