// Workspace dialogs (G6.1 A): Draft settings, the delete-version confirm and the stop-job confirm.
import { type ReactElement } from 'react'
import { Play } from 'lucide-react'
import { Button } from '@/shared/ui/primitives/button'
import { Checkbox } from '@/shared/ui/primitives/checkbox'
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/shared/ui/primitives/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/shared/ui/primitives/alert-dialog'
import { Field, Fieldset } from '@/shared/ui/primitives/field'
import { Input } from '@/shared/ui/primitives/input'
import { NumberField } from '@/shared/ui/primitives/number-field'
import { MinecraftVersionSelect } from '@/entities/settings/ui/MinecraftVersionSelect'
import { ConfirmDestructive } from '@/shared/ui/feedback/ConfirmDestructive'
import { stem } from '@/entities/review/model/review'
import { CAMERA_LABELS } from '@/entities/build/model/workspace'
import { VIEWS, type ViewName } from '@/entities/viewer/model/look'
import { useUpgradeTarget } from '../model/actions'
import type { RunOptions } from '@/entities/job/model/run'
import { MINECRAFT_VERSIONS } from '@shared/minecraft'

const AREA = [
  ['x0', 'West edge (X)'],
  ['z0', 'North edge (Z)'],
  ['sx', 'Width (blocks)'],
  ['sz', 'Depth (blocks)']
] as const

export function DraftSettings({
  open,
  onOpenChange,
  value,
  onChange,
  onRun,
  canRun,
  onClosed
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: RunOptions
  onChange: (value: RunOptions) => void
  onRun: () => void
  canRun: boolean
  /** Where focus goes back to (the More button). */
  onClosed: () => void
}): ReactElement {
  const angles = value.views?.split(',').filter(Boolean) ?? []
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        phone="sheet"
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          onClosed()
        }}
      >
        <form
          className="contents"
          onSubmit={(event) => {
            event.preventDefault()
            if (!canRun) return
            onRun()
            onOpenChange(false)
          }}
        >
          <DialogHeader>
            <DialogTitle>Draft settings</DialogTitle>
            <DialogDescription>
              Choose which area to generate. Empty fields use this build’s defaults. Your choices
              are remembered for this build.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            <Field label="Output name">
              <Input
                value={value.name ?? ''}
                placeholder="Build default"
                onChange={(e) => onChange({ ...value, name: e.target.value || undefined })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              {AREA.map(([key, label]) => (
                <Field key={key} label={label}>
                  <NumberField
                    value={value[key] ?? null}
                    onValueChange={(n) => onChange({ ...value, [key]: n ?? undefined })}
                    min={key === 'sx' || key === 'sz' ? 1 : undefined}
                    placeholder="Build default"
                    hideStepper
                  />
                </Field>
              ))}
            </div>
            <Field label="Create preview images" orientation="horizontal">
              <Checkbox
                checked={!value.noRender}
                onCheckedChange={(on) => onChange({ ...value, noRender: on !== true || undefined })}
              />
            </Field>
            {!value.noRender && (
              <Fieldset
                legend="Preview angles"
                description="Leave unselected to use the build’s defaults."
              >
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  {Object.keys(VIEWS).map((angle) => (
                    <Field
                      key={angle}
                      label={CAMERA_LABELS[angle as ViewName] ?? angle}
                      orientation="horizontal"
                    >
                      <Checkbox
                        checked={angles.includes(angle)}
                        onCheckedChange={(on) => {
                          const next =
                            on === true ? [...angles, angle] : angles.filter((a) => a !== angle)
                          onChange({ ...value, views: next.join(',') || undefined })
                        }}
                      />
                    </Field>
                  ))}
                </div>
              </Fieldset>
            )}
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              className="sm:me-auto"
              onClick={() =>
                onChange({
                  ...value,
                  name: undefined,
                  x0: undefined,
                  z0: undefined,
                  sx: undefined,
                  sz: undefined,
                  views: undefined,
                  noRender: undefined
                })
              }
            >
              Reset
            </Button>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Close
              </Button>
            </DialogClose>
            <Button type="submit" variant="primary" disabled={!canRun}>
              <Play aria-hidden="true" /> Generate draft
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function DeleteVersion({
  path,
  onCancel,
  onConfirm,
  onClosed
}: {
  /** The version to delete; null keeps the dialog closed. */
  path: string | null
  onCancel: () => void
  onConfirm: (path: string) => void
  onClosed: () => void
}): ReactElement {
  return (
    <ConfirmDestructive
      open={!!path}
      onOpenChange={(open) => !open && onCancel()}
      title={`Delete ${path ? stem(path) : 'version'}?`}
      onCloseAutoFocus={(event) => {
        event.preventDefault()
        onClosed()
      }}
      onConfirm={() => path && onConfirm(path)}
    >
      <p>{path?.split('/').pop()} and its preview images will move to the Recycle Bin.</p>
    </ConfirmDestructive>
  )
}

/** Esc while a job runs: stopping throws the job's work away, so it asks first. */
export function StopJob({
  what,
  open,
  onOpenChange,
  onStop
}: {
  /** The job's label, e.g. "Draft generation". */
  what: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onStop: () => void
}): ReactElement {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Stop {what.toLowerCase()}?</AlertDialogTitle>
          <AlertDialogDescription>
            The build stops where it is. Versions it already saved stay in the project folder.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep running</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onStop}>
            Stop
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function UpgradeTarget({
  name,
  current,
  open,
  onOpenChange,
  onClosed
}: {
  name: string
  current: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onClosed: () => void
}): ReactElement {
  const { version, setSelectedVersion, busy, close, upgrade } = useUpgradeTarget(
    name,
    current,
    onOpenChange
  )
  return (
    <Dialog open={open} onOpenChange={(next) => !busy && (next ? onOpenChange(true) : close())}>
      <DialogContent
        phone="sheet"
        showCloseButton={!busy}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          onClosed()
        }}
      >
        <DialogHeader>
          <DialogTitle>Upgrade Minecraft target</DialogTitle>
          <DialogDescription>
            New drafts and exports will use Minecraft Java {version}. Existing drafts keep their
            Minecraft version.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Field label="New target">
            <MinecraftVersionSelect
              value={version}
              onChange={setSelectedVersion}
              versions={MINECRAFT_VERSIONS.slice(MINECRAFT_VERSIONS.indexOf(current))}
              disabled={busy}
            />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" disabled={busy} onClick={close}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={busy || version === current}
            onClick={() => void upgrade()}
          >
            {busy ? 'Upgrading…' : 'Upgrade target'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
