// Settings › Minecraft: the default target, per-version game files and game folders.
import { useState, type FormEvent, type ReactElement } from 'react'
import { CircleCheck, CircleDashed, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { Badge } from '@/shared/ui/primitives/badge'
import { Button } from '@/shared/ui/primitives/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/shared/ui/primitives/dialog'
import { Field } from '@/shared/ui/primitives/field'
import { Input } from '@/shared/ui/primitives/input'
import { StatusBadge } from '@/shared/ui/status/StatusBadge'
import { SettingsPanel, SettingsRow } from '@/entities/settings/ui/Settings'
import { MinecraftVersionSelect } from '@/entities/settings/ui/MinecraftVersionSelect'
import { useAvailability } from '@/entities/availability/model/availability'
import type { Settings } from '@shared/api'
import { DEFAULT_MINECRAFT_VERSION } from '@shared/minecraft'
import { SettingInput } from './bits'
import { useLocations, useMissingPaths, useSaveSettings } from '@/entities/settings/model/save'
import { useInstallations } from '@/entities/settings/model/detected'
import { refreshAvailability } from '../model/minecraft'
import {
  addableMinecraftVersions,
  defaultAddVersion,
  visibleMinecraftVersions,
  withVersionFiles,
  withoutVersionFiles
} from '../model/minecraftVersions'
import { pickPath } from '../model/pick'

type StatusTone = 'ready' | 'optional' | 'needed'
const BADGE: Record<StatusTone, [tone: 'success' | 'warning' | 'neutral', text: string]> = {
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

function AddVersionForm({
  addable,
  installed,
  onCancel,
  onAdd
}: {
  addable: readonly string[]
  installed: readonly { version: string; jar: string }[]
  onCancel: () => void
  onAdd: (version: string, files: { jar?: string; pack?: string }) => void
}): ReactElement {
  const [version, setVersion] = useState(() => defaultAddVersion(addable, installed))
  const [jar, setJar] = useState('')
  const [pack, setPack] = useState('')
  const detectedJar = installed.find((item) => item.version === version)?.jar ?? ''

  const submit = (e: FormEvent): void => {
    e.preventDefault()
    if (!version) return
    onAdd(version, { jar, pack })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Add Minecraft version</DialogTitle>
        <DialogDescription>
          Choose a version to override its client jar or texture pack. Leave a field empty to use
          what Builder Studio finds.
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-4">
        <Field label="Minecraft version">
          <MinecraftVersionSelect
            value={version}
            onChange={setVersion}
            versions={addable}
            label="Minecraft version to add"
            className="w-full"
          />
        </Field>
        <Field label="Client jar" hint="Optional. Used to inspect this version’s blocks.">
          <div className="flex min-w-0 gap-2">
            <Input
              value={jar}
              placeholder={detectedJar || 'Not found automatically'}
              className="min-w-0 flex-1 font-mono text-sm"
              spellCheck={false}
              onChange={(e) => setJar(e.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              aria-label={`Browse for ${version || 'selected version'} client jar`}
              onClick={() =>
                void pickPath('file', jar || detectedJar).then((picked) => picked && setJar(picked))
              }
            >
              Browse…
            </Button>
          </div>
        </Field>
        <Field label="Texture pack" hint="Optional. Overrides the client jar textures.">
          <div className="flex min-w-0 gap-2">
            <Input
              value={pack}
              placeholder="Not set"
              className="min-w-0 flex-1 font-mono text-sm"
              spellCheck={false}
              onChange={(e) => setPack(e.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              aria-label={`Browse for ${version || 'selected version'} texture pack`}
              onClick={() =>
                void pickPath('file', pack).then((picked) => picked && setPack(picked))
              }
            >
              Browse…
            </Button>
          </div>
        </Field>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={!version}>
          Add version
        </Button>
      </DialogFooter>
    </form>
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
  const versions = visibleMinecraftVersions(target, configured)
  const addable = addableMinecraftVersions(versions)
  const [addOpen, setAddOpen] = useState(false)
  const fields: {
    key: 'schematics' | 'saves'
    label: string
    help: string
    browse: 'folder'
    badge: StatusTone
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
          const isTarget = version === target
          return (
            <div key={version} className="flex flex-col gap-4 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-fg">Minecraft {version}</h3>
                  {isTarget && <Badge variant="outline">Default</Badge>}
                </div>
                {!isTarget && (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove Minecraft ${version}`}
                    onClick={() =>
                      save.mutate({ minecraftFiles: withoutVersionFiles(configured, version) })
                    }
                  >
                    <Trash2 aria-hidden />
                    Remove
                  </Button>
                )}
              </div>
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
            title="Other versions"
            detail="Configure a client jar or texture pack for another Minecraft version."
          >
            <Button variant="outline" onClick={() => setAddOpen(true)}>
              <Plus aria-hidden />
              Add version
            </Button>
          </SettingsRow>
        )}
      </SettingsPanel>
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          {addOpen && (
            <AddVersionForm
              addable={addable}
              installed={installed}
              onCancel={() => setAddOpen(false)}
              onAdd={(version, files) => {
                save.mutate({ minecraftFiles: withVersionFiles(configured, version, files) })
                setAddOpen(false)
              }}
            />
          )}
        </DialogContent>
      </Dialog>
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
