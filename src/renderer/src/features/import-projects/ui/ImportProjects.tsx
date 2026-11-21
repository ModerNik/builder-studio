// Import builds: one dialog, opened from Setup › Workspace, Settings › General and the Gallery. Paths are
// previewed as soon as both are filled in; one primary per state (Preview import → Copy and open workspace
// → Cancel import).
import { type ReactElement } from 'react'
import { FolderOpen, MoreHorizontal } from 'lucide-react'
import { Button } from '@/shared/ui/primitives/button'
import { Checkbox } from '@/shared/ui/primitives/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/shared/ui/primitives/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from '@/shared/ui/primitives/dropdown-menu'
import { Field } from '@/shared/ui/primitives/field'
import { IconButton } from '@/shared/ui/primitives/icon-button'
import { Input } from '@/shared/ui/primitives/input'
import { Progress } from '@/shared/ui/primitives/progress'
import { Spinner } from '@/shared/ui/primitives/spinner'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/shared/ui/primitives/collapsible'
import { Alert } from '@/shared/ui/feedback/Alert'
import { KeyValueList } from '@/shared/ui/data/values'
import type { ImportState } from '@shared/api'
import { absolute, cancelImport, useImportForm, useImportState } from '../model/importProjects'

const size = (bytes: number): string =>
  bytes >= 1024 ** 3
    ? `${(bytes / 1024 ** 3).toFixed(1)} GB`
    : `${(bytes / 1024 ** 2).toFixed(1)} MB`

export function ImportDialog({
  open,
  onOpenChange,
  destination
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Where to copy to when it isn't the saved workspace yet (Setup's unsaved field). */
  destination?: string
}): ReactElement {
  const state = useImportState()
  return (
    <Dialog open={open} onOpenChange={(next) => !state.busy && onOpenChange(next)}>
      <DialogContent
        size="lg"
        phone="sheet"
        showCloseButton={!state.busy}
        onInteractOutside={(e) => state.busy && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Import builds</DialogTitle>
          <DialogDescription>
            Copy builds from an older folder. The original is not changed.
          </DialogDescription>
        </DialogHeader>
        {/* remounts on open, so each opening starts from the saved paths */}
        {open && (
          <ImportForm state={state} into={destination} onClose={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ImportForm({
  state,
  into,
  onClose
}: {
  state: ImportState
  into?: string
  onClose: () => void
}): ReactElement {
  const {
    settings,
    source,
    setSource,
    destination,
    setDestination,
    assets,
    setAssets,
    checking,
    busy,
    ready,
    setAttempt,
    preview,
    error,
    pick,
    recover,
    bootstrap,
    copy
  } = useImportForm(state, into, onClose)
  const short = preview && preview.available < preview.required
  const drive = destination.trim().slice(0, 2).toUpperCase()

  const pathField = (kind: 'source' | 'destination'): ReactElement => {
    const label = kind === 'source' ? 'Copy from' : 'Into workspace'
    return (
      <Field
        label={label}
        error={
          (kind === 'source' ? source : destination).trim() &&
          !absolute(kind === 'source' ? source : destination)
            ? 'Enter the full folder path, starting with a drive letter such as C:\\.'
            : undefined
        }
      >
        <span className="flex min-w-0 gap-2">
          <Input
            className="min-w-0 flex-1 font-mono text-sm"
            spellCheck={false}
            value={kind === 'source' ? source : destination}
            disabled={busy || checking}
            onChange={(e) =>
              kind === 'source' ? setSource(e.target.value) : setDestination(e.target.value)
            }
          />
          <Button
            variant="outline"
            className="max-sm:hidden"
            disabled={busy || checking}
            onClick={() => pick(kind)}
          >
            Browse…
          </Button>
          <IconButton
            label={`Browse for ${label.toLowerCase()}`}
            variant="outline"
            className="sm:hidden"
            disabled={busy || checking}
            onClick={() => pick(kind)}
          >
            <FolderOpen aria-hidden />
          </IconButton>
        </span>
      </Field>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        {pathField('source')}
        {pathField('destination')}
        <Field
          orientation="horizontal"
          label="Include the assets library"
          hint="Shared textures, palettes and prefabs. On by default."
        >
          <Checkbox
            checked={assets}
            disabled={busy || checking}
            onCheckedChange={(v) => setAssets(v === true)}
          />
        </Field>
        <p className="text-sm text-fg-secondary">
          Copies builds, archives, data, designs, reviews, references and outputs. Git and agent
          history, environments, engine code and machine settings stay behind. The destination
          becomes your workspace after copying.
        </p>

        {state.busy ? (
          <div className="flex flex-col gap-2 rounded-lg border border-border-default bg-surface-raised p-4">
            <p className="font-medium">{state.stage}</p>
            {state.total > 0 && (
              <>
                <p className="text-sm text-fg-secondary">
                  {size(state.copied)} of {size(state.total)} ·{' '}
                  {Math.round((100 * state.copied) / state.total)}%
                </p>
                <Progress value={(100 * state.copied) / state.total} aria-label="Copying builds" />
              </>
            )}
            <p className="text-sm text-fg-muted">Cancel import removes everything copied so far.</p>
          </div>
        ) : checking ? (
          <p role="status" className="flex items-center gap-2 text-sm text-fg-secondary">
            <Spinner />
            {`Counting files in ${source.trim()}…`}
          </p>
        ) : preview ? (
          <>
            <KeyValueList
              items={[
                { label: 'Builds', value: preview.builds.toLocaleString() },
                {
                  label: 'Files',
                  value: `${preview.files.toLocaleString()} · ${size(preview.bytes)}`
                },
                { label: 'Space needed', value: size(preview.required) },
                { label: `Free on ${drive}`, value: size(preview.available) }
              ]}
            />
            <p className="text-sm text-fg-secondary">
              Existing files are never overwritten. Links and overlapping folders are refused.{' '}
              {drive} has hard links, which the import uses to put the copied files in place.
            </p>
            {short && (
              <Alert tone="danger" title={`Not enough space on ${drive}`}>
                {`The import needs ${size(preview.required)} and ${size(preview.available)} is free. Free some space or choose another destination.`}
              </Alert>
            )}
            {preview.warnings.length > 0 && (
              <Alert tone="warning">
                <Collapsible>
                  <CollapsibleTrigger className="focus-ring cursor-pointer rounded-sm text-start font-medium text-fg underline underline-offset-2">
                    {`${preview.warnings.length} absolute ${preview.warnings.length === 1 ? 'path' : 'paths'} may need fixing`}
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <pre className="mt-2 max-h-48 overflow-auto font-mono text-sm break-all whitespace-pre-wrap select-text">
                      {preview.warnings.join('\n')}
                    </pre>
                  </CollapsibleContent>
                </Collapsible>
                <p className="mt-1">
                  They are copied as they are. Check them before running imported generators.
                </p>
              </Alert>
            )}
          </>
        ) : (
          !error && (
            <p className="text-sm text-fg-secondary">
              Preview import counts the builds and files and checks the space and the drive’s hard
              links before anything is copied.
            </p>
          )
        )}
        {(error || state.error) && (
          <Alert tone="danger" title="The import didn’t run">
            {error || state.error}
          </Alert>
        )}
      </div>
      <DialogFooter className="items-stretch sm:items-center">
        {state.busy ? (
          <Button variant="destructive" onClick={cancelImport}>
            Cancel import
          </Button>
        ) : (
          <>
            {/* phone: the primary full width on top, More and Close in a row under it */}
            <div className="flex items-center gap-2 max-sm:justify-between sm:contents">
              {!checking && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <IconButton
                      label="More: Recover interrupted import, Initialize workspace Git"
                      className="sm:me-auto"
                      disabled={busy}
                    >
                      <MoreHorizontal aria-hidden />
                    </IconButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="max-w-80">
                    <DropdownMenuItem
                      disabled={!absolute(destination)}
                      onSelect={() => void recover()}
                    >
                      Recover interrupted import
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!settings?.workspace}
                      onSelect={() => void bootstrap()}
                    >
                      Initialize workspace Git
                    </DropdownMenuItem>
                    <DropdownMenuLabel className="text-sm font-normal text-fg-muted">
                      Recover finishes or undoes an import that stopped. Initialize makes the
                      workspace a Git repository so build versions can be saved.
                    </DropdownMenuLabel>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <Button variant="ghost" onClick={onClose} className="max-sm:ms-auto">
                Close
              </Button>
            </div>
            {preview ? (
              <Button
                variant="primary"
                disabled={busy || !!short}
                onClick={() => void copy(preview.id)}
              >
                Copy and open workspace
              </Button>
            ) : (
              <Button
                variant="primary"
                disabled={!ready || checking || busy}
                onClick={() => setAttempt((n) => n + 1)}
              >
                {checking ? 'Checking…' : error ? 'Try again' : 'Preview import'}
              </Button>
            )}
          </>
        )}
      </DialogFooter>
    </>
  )
}
