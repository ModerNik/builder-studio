import { lazy, Suspense, useState, type ReactElement, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Alert } from '@/shared/ui/feedback/Alert'
import { LoadingState } from '@/shared/ui/feedback/LoadingState'
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
import { SchematicPlacementControls } from '@/entities/viewer/ui/SchematicPlacementControls'
import { ViewerErrorCard, ViewerLoadingCard } from '@/entities/viewer/ui/ViewerCards'
import {
  commitSchematic,
  useSchematicFile,
  useSchematicInspection,
  type SchematicFile
} from '@/features/import-schematic/model/schematic'
import { useBuild } from '@/entities/build/model/builds'
import { useMinecraftPack, useSettings } from '@/entities/settings/model/settings'
import { DEFAULT_MINECRAFT_VERSION } from '@shared/minecraft'
import { errorText } from '@/entities/build/model/workspace'
import type { ViewName } from '@/entities/viewer/model/look'
import type { BlockCoordinates, SchematicSession } from '@shared/api'

// the gallery's first chunk imports this file for SchematicFileField: the 3D renderer stays out of it
const BuildViewer = lazy(() =>
  import('@/entities/viewer/ui/BuildViewer').then((m) => ({ default: m.BuildViewer }))
)

export function SchematicFileField({
  file,
  optional,
  disabled
}: {
  file: SchematicFile
  optional?: boolean
  disabled?: boolean
}): ReactElement {
  const { source, choosing, choose, clear, failure } = file
  return (
    <div className="grid gap-3">
      <Field
        label={optional ? 'Start from a schematic' : 'Schematic file'}
        hint={
          source
            ? `${source.size.join(' × ')} blocks. ${source.blocks.toLocaleString()} occupied.`
            : '.litematic, .schem, .nbt or .schematic'
        }
        error={failure || undefined}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {source && <span className="min-w-0 wrap-anywhere font-mono text-sm">{source.name}</span>}
          <Button
            type="button"
            variant="outline"
            disabled={choosing || disabled}
            onClick={() => void choose()}
          >
            {choosing ? 'Reading schematic…' : source ? 'Choose another file' : 'Choose schematic…'}
          </Button>
          {optional && source && (
            <Button type="button" variant="ghost" disabled={choosing || disabled} onClick={clear}>
              Remove
            </Button>
          )}
        </div>
      </Field>
      {source && source.warnings.length > 0 && (
        <Alert tone="info" title="Only blocks are imported">
          {source.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
          <p>The original file is kept with the build.</p>
        </Alert>
      )}
    </div>
  )
}

export function ImportSchematicDialog({
  build,
  open,
  onOpenChange,
  onClosed,
  onImported
}: {
  build: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onClosed: () => void
  onImported: (draft: string | undefined) => void
}): ReactElement {
  const buildInfo = useBuild(build).data
  const settings = useSettings().data
  const target = buildInfo
    ? (buildInfo.minecraftVersion ?? settings?.minecraftVersion ?? DEFAULT_MINECRAFT_VERSION)
    : undefined
  const file = useSchematicFile(build, target)
  const pack = useMinecraftPack(open ? (file.source?.minecraftVersion ?? target) : undefined)
  const [busy, setBusy] = useState(false)
  const close = (): void => {
    file.clear()
    onOpenChange(false)
  }
  const commit = async (input: {
    position: BlockCoordinates
    revision: string
    replace: string[]
  }): Promise<void> => {
    if (!file.source || busy) return
    setBusy(true)
    try {
      const result = await commitSchematic({ id: file.source.id, ...input })
      onImported(result.part)
      close()
    } finally {
      setBusy(false)
    }
  }
  const disabled = busy || file.choosing
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !disabled && close()}>
      <DialogContent
        size="lg"
        phone="sheet"
        showCloseButton={!disabled}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          onClosed()
        }}
      >
        <DialogHeader>
          <DialogTitle>Import schematic</DialogTitle>
          <DialogDescription>
            {buildInfo
              ? `Place the schematic as a part of this build using Minecraft Java ${target}.`
              : 'Loading this build’s Minecraft target…'}
          </DialogDescription>
        </DialogHeader>
        {file.source ? (
          <Placement
            key={file.source.id}
            source={file.source}
            pack={pack.data}
            packLoading={pack.isLoading}
            packError={pack.error}
            busy={disabled}
            onCommit={commit}
            onCancel={close}
          >
            <SchematicFileField file={file} disabled={busy || !buildInfo} />
          </Placement>
        ) : (
          <>
            <DialogBody>
              <SchematicFileField file={file} disabled={busy || !buildInfo} />
            </DialogBody>
            <DialogFooter>
              <Button variant="ghost" disabled={disabled} onClick={close}>
                Cancel
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Placement({
  source,
  pack,
  packLoading,
  packError,
  busy,
  onCommit,
  onCancel,
  children
}: {
  source: SchematicSession
  pack?: string
  packLoading: boolean
  packError: Error | null
  busy: boolean
  onCommit: (value: {
    position: BlockCoordinates
    revision: string
    replace: string[]
  }) => Promise<void>
  onCancel: () => void
  children: ReactNode
}): ReactElement {
  const [position, setPosition] = useState<BlockCoordinates>([0, 0, 0])
  const [replace, setReplace] = useState<string[]>([])
  const [view, setView] = useState<ViewName>('orbit')
  const [commitError, setCommitError] = useState('')
  const [retry, setRetry] = useState(0)
  const [x, y, z] = position
  const key = `${x},${y},${z}/${retry}`
  const { preview, issue } = useSchematicInspection(source.id, position, key)
  const current = preview?.key === key ? preview.result : undefined
  const error = issue?.key === key ? issue.message : ''
  const checking = !current && !error
  const winners =
    current?.overlaps.filter((row) => replace.includes(row.owner)).map((row) => row.owner) ?? []
  const kept =
    current?.overlaps.reduce(
      (count, row) => (winners.includes(row.owner) ? count : count + row.count),
      0
    ) ?? 0
  const canImport = current && kept < current.blocks

  const move = (next: BlockCoordinates): void => {
    if (!busy) setPosition(next)
  }
  const confirm = async (): Promise<void> => {
    if (busy || !canImport || !current) return
    setCommitError('')
    try {
      await onCommit({ position, revision: current.revision, replace: winners })
    } catch (error) {
      setCommitError(errorText(error))
      setRetry((n) => n + 1)
    }
  }

  return (
    <>
      <DialogBody className="flex flex-col gap-4">
        {children}
        {preview ? (
          <div className="relative h-72 min-w-0 shrink-0 overflow-hidden rounded-lg border border-border-default bg-surface-viewer">
            {pack ? (
              <Suspense fallback={<ViewerLoadingCard label="Loading the 3D view…" />}>
                <BuildViewer
                  src={preview.result.baseUrl}
                  pack={pack}
                  view={view}
                  onViewChange={setView}
                  placement={{
                    src: source.sourceUrl,
                    position,
                    onPositionChange: move,
                    enabled: !busy
                  }}
                  shared
                />
              </Suspense>
            ) : packLoading ? (
              <ViewerLoadingCard
                label={`Preparing Minecraft ${source.minecraftVersion ?? DEFAULT_MINECRAFT_VERSION} textures…`}
              />
            ) : (
              <ViewerErrorCard
                title="Minecraft textures could not be prepared"
                details={String(packError ?? '')}
                actions={
                  <Button variant="outline" asChild>
                    <Link to="/settings" search={{ section: 'minecraft' }}>
                      Open Settings
                    </Link>
                  </Button>
                }
              />
            )}
          </div>
        ) : checking ? (
          <LoadingState label="Preparing placement preview" />
        ) : null}
        {(commitError || error) && <Alert tone="danger">{error || commitError}</Alert>}
        {error && (
          <Button variant="outline" disabled={busy} onClick={() => setRetry((n) => n + 1)}>
            Retry preview
          </Button>
        )}
        {(preview || !error) && (
          <SchematicPlacementControls
            position={position}
            onPositionChange={move}
            overlaps={current?.overlaps ?? []}
            replace={replace}
            onReplaceChange={(next) => !busy && setReplace(next)}
            checking={checking}
            disabled={busy}
          />
        )}
        {current && kept === current.blocks && (
          <Alert tone="info">Move the schematic or replace an overlap to add blocks.</Alert>
        )}
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" disabled={busy || !canImport} onClick={() => void confirm()}>
          {busy ? 'Importing…' : 'Import part'}
        </Button>
      </DialogFooter>
    </>
  )
}
