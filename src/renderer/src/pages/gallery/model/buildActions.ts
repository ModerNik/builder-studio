// What the Gallery's dialogs do: create a build (empty or from a schematic), rename one, delete one.
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { NewBuildNameSchema } from '@shared/api'
import { normalizeProjectName, slugFromProjectName } from '@shared/project-name'
import { DEFAULT_MINECRAFT_VERSION } from '@shared/minecraft'
import { errorMessage } from '@/shared/ui/feedback/errors'
import { studio } from '@/shared/api/studio'
import { useSettings } from '@/entities/settings/model/settings'
import { useRunOptions } from '@/entities/job/model/run'
import { commitSchematic, useSchematicFile } from '@/features/import-schematic/model/schematic'
import { nameFromFile } from './buildName'

/** No workspace yet: reopen first-run setup at the workspace step. */
export const openSetup = (): void =>
  void studio.setup
    .progress({ step: 'workspace', completed: false })
    .then(() => window.location.reload())

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- the dialog reads all of it
export function useNewBuild(
  takenDisplayNames: string[],
  takenFolders: string[],
  onOpenChange: (open: boolean) => void
) {
  const navigate = useNavigate()
  const [name, setNameValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const settings = useSettings()
  const defaultVersion = settings.data?.minecraftVersion ?? DEFAULT_MINECRAFT_VERSION
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null)
  const minecraftVersion = selectedVersion ?? defaultVersion
  const schematic = useSchematicFile(undefined, minecraftVersion)
  // a chosen file names the build when the name is still empty
  const file = {
    ...schematic,
    choose: async () => {
      const next = await schematic.choose()
      if (next) setNameValue((current) => current || nameFromFile(next.name, takenDisplayNames))
      return next
    }
  }
  const setName = (next: string): void => {
    setNameValue(next)
    setFailure('')
  }
  const takenSet = new Set(takenDisplayNames.map(normalizeProjectName))
  const parsed = NewBuildNameSchema.safeParse(name)
  const rule = !name
    ? ''
    : !parsed.success
      ? parsed.error.issues[0].message
      : takenSet.has(normalizeProjectName(parsed.data))
        ? `“${parsed.data}” is taken. Pick another.`
        : ''
  const folder = parsed.success && !rule ? slugFromProjectName(parsed.data, takenFolders) : ''
  /** False when the name needs fixing: the dialog moves focus to it. */
  const create = async (): Promise<boolean> => {
    if (busy || file.choosing) return true
    if (!name.trim()) setFailure('Enter a project name.')
    if (!parsed.success || rule) return false
    setBusy(true)
    setFailure('')
    try {
      const created = file.source
        ? (await commitSchematic({ id: file.source.id, name: parsed.data })).build
        : await studio.builds.create(parsed.data, minecraftVersion)
      file.clear()
      setSelectedVersion(null)
      onOpenChange(false)
      setNameValue('')
      await navigate({ to: '/build/$name', params: { name: created } })
    } catch (e) {
      setFailure(errorMessage(e))
    } finally {
      setBusy(false)
    }
    return true
  }
  const close = (): void => {
    file.clear()
    setSelectedVersion(null)
    setFailure('')
    onOpenChange(false)
  }

  return {
    name,
    setName,
    busy,
    failure,
    minecraftVersion,
    setSelectedVersion,
    file,
    parsed,
    folder,
    rule,
    create,
    close
  }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- the dialog reads all of it
export function useRenameBuild(
  build: { name: string; displayName: string },
  takenDisplayNames: string[],
  onClose: () => void
) {
  const [to, setTo] = useState(build.displayName)
  const rename = useRunOptions((s) => s.rename)
  const parsed = NewBuildNameSchema.safeParse(to)
  const currentNorm = normalizeProjectName(build.displayName)
  const otherTaken = new Set(
    takenDisplayNames.map(normalizeProjectName).filter((n) => n !== currentNorm)
  )
  const error = !parsed.success
    ? parsed.error.issues[0].message
    : otherTaken.has(normalizeProjectName(parsed.data))
      ? 'Taken. Pick another name.'
      : ''
  const submit = (): void => {
    if (error || !parsed.success) return
    if (parsed.data === build.displayName) return onClose()
    studio.builds.rename(build.name, parsed.data).then(
      (now) => {
        if (now !== build.name) rename(build.name, now)
        onClose()
      },
      (e) => toast.error(errorMessage(e))
    )
  }

  return { to, setTo, error, submit }
}

/** Delete keeps the knowledge: the size of out/ for the confirm text, and the archive call. */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- the dialog reads all of it
export function useDeleteBuild(name: string | null) {
  const size = useQuery({
    queryKey: ['outSize', name],
    queryFn: () => studio.builds.outSize(name!),
    enabled: !!name
  })
  const archive = (): void =>
    void studio.builds.archive(name!).then(
      (to) => toast.success(`Archived to ${to.replaceAll('/', '\\')}`),
      (e) => toast.error(errorMessage(e))
    )
  return { size, archive }
}
