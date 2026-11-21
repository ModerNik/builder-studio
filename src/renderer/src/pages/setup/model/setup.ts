// What first-run setup does: the step draft, saving and moving between steps, build tool preparation, file pickers.
import { useEffect, useState } from 'react'
import { useMutation, useQuery, type UseQueryResult } from '@tanstack/react-query'
import { errorMessage } from '@/shared/ui/feedback/errors'
import { queryClient, studio } from '@/shared/api/studio'
import { useAvailability } from '@/entities/availability/model/availability'
import { useSettings } from '@/entities/settings/model/settings'
import { useInstallations } from '@/entities/settings/model/detected'
import { SETUP_STEPS, type Availability, type RuntimeState, type Settings } from '@shared/api'
import { SETUP_REQUIREMENTS } from '@shared/availability'
import { DEFAULT_MINECRAFT_VERSION } from '@shared/minecraft'
import { STEPS, absolute } from './steps'

type Step = Settings['setup']['step']

export const pickFile = (current: string): Promise<string | null> => studio.setup.pickFile(current)
export const pickFolder = (current: string): Promise<string | null> =>
  studio.workspace.pick(current)

export const checkTextures = async (save: () => Promise<void>): Promise<void> => {
  await save()
  queryClient.setQueryData(['availability'], await studio.availability.get(true))
}

/** Availability, rechecked each time the Ready step opens. */
export function useFreshAvailability(): UseQueryResult<Availability> {
  const availability = useAvailability()
  useEffect(() => void queryClient.invalidateQueries({ queryKey: ['availability'] }), [])
  return availability
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- the screen reads all of it
export function useSetup() {
  const settings = useSettings()
  const suggestion = useQuery({
    queryKey: ['workspace-suggestion'],
    queryFn: studio.setup.suggestion
  })
  const installations = useInstallations(settings.data?.setup.step === 'minecraft')
  const [draft, setDraft] = useState<Partial<Settings>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [runtime, setRuntime] = useState<RuntimeState>({ busy: false, stage: 'idle' })
  const availability = useAvailability()
  const delivery = useQuery({ queryKey: ['runtime-delivery'], queryFn: studio.runtime.delivery })
  const preparation = useMutation({
    mutationFn: studio.setup.prepare,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['availability'] })
  })
  const { mutate: prepare } = preparation
  useEffect(() => {
    void studio.runtime.state().then(setRuntime)
    return studio.runtime.onState((state) => {
      setRuntime(state)
      if (!state.busy) void queryClient.invalidateQueries()
    })
  }, [])
  // where the user has been this session; done and skipped are not persisted
  const [reached, setReached] = useState(0)
  const [done, setDone] = useState<ReadonlySet<Step>>(
    () => new Set(SETUP_STEPS.slice(0, SETUP_STEPS.indexOf(settings.data?.setup.step ?? 'welcome')))
  )
  const [skipped, setSkipped] = useState<ReadonlySet<Step>>(new Set())
  // a rerun from Settings starts with a workspace already chosen
  const [again] = useState(() => !!settings.data?.workspace)
  const saved = settings.data!
  const step = saved.setup.step
  useEffect(() => {
    if (step === 'runtime') prepare()
  }, [step, prepare])
  const index = SETUP_STEPS.indexOf(step)
  const top = Math.max(reached, index)
  // the suggested folder fills an empty workspace until the user edits the field
  const prefill =
    step === 'workspace' && !saved.workspace && draft.workspace === undefined
      ? suggestion.data
      : undefined
  const suggestedVersion =
    step === 'minecraft' && !saved.minecraftVersion && !draft.minecraftVersion
      ? (installations.data?.[0]?.version ?? DEFAULT_MINECRAFT_VERSION)
      : undefined
  const changes = prefill
    ? { ...draft, workspace: prefill }
    : suggestedVersion
      ? { ...draft, minecraftVersion: suggestedVersion }
      : draft
  const form = { ...saved, ...changes }
  const blocked = busy || runtime.busy || preparation.isPending
  const needs =
    step === 'verify' ? SETUP_REQUIREMENTS : step === 'runtime' ? STEPS.runtime.needs : []
  const valid =
    (step !== 'workspace' || absolute(form.workspace)) &&
    needs.every((r) => availability.data?.requirements[r].ok)

  const act = (fn: () => Promise<void>): void => {
    setBusy(true)
    setError('')
    fn()
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setBusy(false))
  }
  const save = async (): Promise<void> => {
    if (!Object.keys(changes).length) return
    const latest = await studio.settings.get()
    const body = { ...latest, ...changes }
    const next = await studio.settings.set({ ...body, workspace: body.workspace.trim() })
    queryClient.setQueryData(['settings'], next)
    setDraft({})
  }
  const without = (set: ReadonlySet<Step>, s: Step): Set<Step> => {
    const next = new Set(set)
    next.delete(s)
    return next
  }
  // continue saves the draft; skip drops this step's part of it; move keeps it for later
  const go = (to: Step, how: 'continue' | 'skip' | 'move', completed = false): void => {
    if (blocked) return
    act(async () => {
      if (how === 'continue') await save()
      const next = await studio.setup.progress({ step: to, completed })
      if (how === 'skip')
        setDraft((d) =>
          Object.fromEntries(
            Object.entries(d).filter(([k]) => !STEPS[step].keys.includes(k as keyof Settings))
          )
        )
      if (how === 'continue') {
        setDone((d) => new Set(d).add(step))
        setSkipped((s) => without(s, step))
      }
      if (how === 'skip') {
        setSkipped((s) => new Set(s).add(step))
        setDone((d) => without(d, step))
      }
      setReached((r) => Math.max(r, SETUP_STEPS.indexOf(to)))
      queryClient.setQueryData(['settings'], next)
      if (completed) window.location.hash = '/'
    })
  }
  const nextStep = SETUP_STEPS[index + 1] ?? 'verify'
  const props = { form, act, save, patch: (p: Partial<Settings>) => setDraft({ ...draft, ...p }) }
  return {
    suggestion,
    error,
    runtime,
    delivery,
    preparation,
    prepare,
    done,
    skipped,
    again,
    saved,
    step,
    index,
    top,
    blocked,
    valid,
    go,
    nextStep,
    props
  }
}
