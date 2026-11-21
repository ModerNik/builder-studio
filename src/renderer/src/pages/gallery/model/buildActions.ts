// What the Gallery's dialogs do: create a build (empty or from a schematic), rename one, delete one.
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { NewBuildNameSchema } from '@shared/api'
import { DEFAULT_MINECRAFT_VERSION } from '@shared/minecraft'
import { errorMessage } from '@/shared/ui/feedback/errors'
import { studio } from '@/shared/api/studio'
import { useSettings } from '@/entities/settings/model/settings'
import { useRunOptions } from '@/entities/job/model/run'
import { commitSchematic, useSchematicFile } from '@/features/import-schematic/model/schematic'
import { nameFromFile } from './buildName'

const NAME = /^[\w.-]+$/

/** No workspace yet: reopen first-run setup at the workspace step. */
export const openSetup = (): void =>
  void studio.setup
    .progress({ step: 'workspace', completed: false })
    .then(() => window.location.reload())

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- the dialog reads all of it
export function useNewBuild(taken: string[], onOpenChange: (open: boolean) => void) {
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
      if (next) setNameValue((current) => current || nameFromFile(next.name, taken))
      return next
    }
  }
  const setName = (next: string): void => {
    setNameValue(next)
    setFailure('')
  }
  const parsed = NewBuildNameSchema.safeParse(name)
  const rule = !name
    ? ''
    : taken.includes(name)
      ? `“${name}” is taken. Pick another.`
      : parsed.success
        ? ''
        : parsed.error.issues[0].message === 'Reserved Windows name'
          ? `“${name}” is a reserved Windows name. Pick another.`
          : 'Use lowercase letters, digits and _, starting with a letter.'
  /** False when the name needs fixing: the dialog moves focus to it. */
  const create = async (): Promise<boolean> => {
    if (busy || file.choosing) return true
    if (!name) setFailure('Enter a build name.')
    if (!parsed.success || rule) return false
    setBusy(true)
    setFailure('')
    try {
      const created = file.source
        ? (await commitSchematic({ id: file.source.id, name })).build
        : await studio.builds.create(name, minecraftVersion)
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
    rule,
    create,
    close
  }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- the dialog reads all of it
export function useRenameBuild(name: string, taken: string[], onClose: () => void) {
  const dir = name.includes('/') ? name.slice(0, name.lastIndexOf('/') + 1) : '' // _examples/ stays put
  const [to, setTo] = useState(name.slice(dir.length))
  const rename = useRunOptions((s) => s.rename)
  const error =
    !NAME.test(to) || to.startsWith('_')
      ? 'Use letters, digits, _ . and -, not starting with _.'
      : taken.includes(dir + to) && dir + to !== name
        ? 'Taken. Pick another name.'
        : ''
  const submit = (): void => {
    if (error) return
    if (dir + to === name) return onClose()
    studio.builds.rename(name, to).then(
      (now) => {
        rename(name, now)
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
