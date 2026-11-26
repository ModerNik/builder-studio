// The Export screen's state and steps: the jobs it reads, the checks it runs and the IPC calls behind each row.
// ui/Ship.tsx renders what this returns.
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { DEFAULT_LINTER_SETTINGS, type BillResult, type Job, type JobSpec } from '@shared/api'
import { DEFAULT_MINECRAFT_VERSION } from '@shared/minecraft'
import type { CheckStatus } from '@/shared/ui/data/progress'
import { hasEnabledLintRule, lintProblems } from '@/shared/lib/format'
import { queryClient, studio } from '@/shared/api/studio'
import { lastOf, useJobs } from '@/entities/job/model/jobs'
import { useAvailability } from '@/entities/availability/model/availability'
import { useBuild } from '@/entities/build/model/builds'
import { useMinecraftPack, useSettings } from '@/entities/settings/model/settings'
import { stem } from '@/entities/review/model/review'
import { errorText } from '@/entities/build/model/workspace'
import { lintText, rareBlocks, rejectedVariants, waitForJob } from './ship'

export type Out = { status: CheckStatus; text: string }
const IDLE: Out = { status: 'idle', text: '' }

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- the screen reads most of this state
export function useExport(name: string) {
  const availability = useAvailability().data
  const { data: build } = useBuild(name)
  const settings = useSettings().data
  const minecraftVersion =
    build?.minecraftVersion ?? settings?.minecraftVersion ?? DEFAULT_MINECRAFT_VERSION
  const targetPack = useMinecraftPack(minecraftVersion)
  const jobs = useJobs((s) => s.jobs)
  const logs = useJobs((s) => s.logs)
  const rounds = useQuery({ queryKey: ['rounds', name], queryFn: () => studio.review.list(name) })
  const [dry, setDry] = useState(true)
  const [selected, setSelected] = useState(1)
  const [sequencing, setSequencing] = useState(false)
  const [setup, setSetup] = useState<Out>(IDLE)
  const [reload, setReload] = useState<Out & { bill?: BillResult }>(IDLE)
  const [copied, setCopied] = useState<Out & { dry?: boolean }>(IDLE)
  const [results, setResults] = useState<Out & { title?: string; rows?: [string, string][] }>(IDLE)
  const [commit, setCommit] = useState<Out & { output?: string }>(IDLE)
  const [deleted, setDeleted] = useState<number | null>(null)
  const [confirm, setConfirm] = useState<null | 'finalize' | 'commit' | 'reject'>(null)
  const [pending, setPending] = useState('') // git status shown in the commit confirm

  const check = jobs.find(
    (j) =>
      j.spec.build === name &&
      j.spec.part === 'check' &&
      (j.minecraftVersion ?? DEFAULT_MINECRAFT_VERSION) === minecraftVersion
  )
  const full = jobs.find(
    (j) =>
      j.spec.build === name &&
      j.spec.part === 'full' &&
      j.spec.ship &&
      (j.minecraftVersion ?? DEFAULT_MINECRAFT_VERSION) === minecraftVersion
  )
  const linter = settings?.linter ?? DEFAULT_LINTER_SETTINGS
  const lintActive = linter.enabled && hasEnabledLintRule(linter.rules)
  const lint = lastOf(check).lint
  const problems = !lintActive ? 0 : lint ? lintProblems(lint.counts, linter.rules) : null
  const f = lastOf(full)
  const built = full?.state === 'done' && f.wrote ? f.wrote : undefined
  const busy = sequencing || jobs.some((j) => j.spec.build === name && j.state === 'running')
  const bill = reload.bill ?? f.bill
  const rare = rareBlocks(bill?.top ?? [])
  const engine = !!availability?.features.engine.ok
  const gitOk = availability ? availability.features.commit.ok : true
  const noFolder = !dry && !settings?.schematics
  const rejected = rejectedVariants(
    rounds.data ?? [],
    (build?.versions ?? []).map((v) => v.path)
  )
  const variant = built ? stem(built.path) : 'the full build'
  const logOf = (j: Job | undefined): string[] => (j ? (logs[j.id] ?? j.log) : [])

  async function connect(): Promise<boolean> {
    setSetup({
      status: 'running',
      text: `Checking Minecraft ${minecraftVersion}, build tools and export…`
    })
    try {
      await queryClient.cancelQueries({ queryKey: ['availability'] })
      const checked = await studio.availability.get(true)
      queryClient.setQueryData(['availability'], checked)
      const bad = [
        ...new Set([...checked.features.engine.missing, ...checked.features.export.missing])
      ]
      setSetup({
        status: bad.length ? 'failed' : 'done',
        text: bad.length
          ? bad.map((n) => checked.requirements[n].detail).join('; ')
          : `Minecraft ${minecraftVersion}, build tools and export destination available`
      })
      return !bad.length
    } catch (e) {
      setSetup({ status: 'failed', text: errorText(e) })
      return false
    }
  }

  async function runJob(spec: JobSpec): Promise<Job | null> {
    try {
      return await waitForJob(await studio.jobs.run(spec))
    } catch (e) {
      toast.error(errorText(e))
      return null
    }
  }

  async function reloadCheck(job: Job | undefined = full): Promise<void> {
    const ev = lastOf(job)
    const wrote = ev.wrote
    const copied = job?.events.find((event) => event.event === 'copied')
    if (!wrote || !copied) return
    const artifactVersion = job?.minecraftVersion ?? DEFAULT_MINECRAFT_VERSION
    setReload({ status: 'running', text: `Reading ${copied.path.split('/').pop()} back…` })
    try {
      const got = await studio.bridge.call(
        'bill',
        { path: copied.path, top: 1000 },
        undefined,
        artifactVersion
      )
      const layer = await studio.bridge.call(
        'layer',
        { path: copied.path, y: 0 },
        undefined,
        artifactVersion
      )
      const ok = got.total === ev.bill?.total && layer.shape.join() === wrote.shape.join()
      setReload({
        status: ok ? 'done' : 'failed',
        bill: got,
        text: `reloaded ${got.total.toLocaleString()} blocks (job said ${ev.bill?.total.toLocaleString() ?? '?'}), shape ${layer.shape.join('×')} (wrote ${wrote.shape.join('×')})`
      })
    } catch (e) {
      setReload({ status: 'failed', text: errorText(e) })
    }
  }

  // Run steps 1 to 6: Check, Run check, Build, Reload in order, stopping at the first failure
  async function runSteps(): Promise<void> {
    setSequencing(true)
    try {
      setSelected(1)
      if (!(await connect())) return
      if (lintActive) {
        setSelected(2)
        const c = await runJob({ part: 'check', build: name })
        const counts = lastOf(c ?? undefined).lint?.counts
        if (c?.state !== 'done' || !counts || lintProblems(counts, linter.rules) !== 0) return
      }
      setSelected(3)
      const b = await runJob({ part: 'full', build: name, ship: true, noRender: !targetPack.data })
      if (b?.state !== 'done') return
      setSelected(6)
      await reloadCheck(b)
    } finally {
      setSequencing(false)
    }
  }

  async function finalize(): Promise<void> {
    if (!full) return
    setCopied({ status: 'running', text: 'Copying…' })
    try {
      setCopied({ status: 'done', text: await studio.ship.finalize(full.id, dry), dry })
    } catch (e) {
      setCopied({ status: 'failed', text: errorText(e) })
    }
  }

  async function writeResults(): Promise<void> {
    if (!built) return
    const title = `Shipped ${stem(built.path)} (${new Date().toLocaleDateString('sv')})`
    const rows: [string, string][] = [
      ['File', built.path],
      ['Shape', built.shape.join(' × ')],
      ['Paste at', built.paste.join(', ')],
      [
        'Lint',
        !linter.enabled
          ? 'skipped (linter off)'
          : !lintActive
            ? 'skipped (all rules off)'
            : lintText(lint?.counts, linter.rules)
      ],
      [
        'Blocks',
        `${f.blocks?.total.toLocaleString() ?? '?'}, hidden removed ${f.blocks?.hidden_removed?.toLocaleString() ?? '?'}`
      ],
      [
        'Bill',
        `${f.bill?.total.toLocaleString() ?? '?'} blocks; top ${(f.bill?.top ?? [])
          .slice(0, 5)
          .map(([s, c]) => `${s} ${c}`)
          .join(', ')}`
      ],
      ['Rare', rare.map(([s, c]) => `${s} ${c}`).join(', ') || 'none'],
      [
        'Reload check',
        reload.status === 'done'
          ? 'bill and shape match'
          : reload.status === 'failed'
            ? reload.text
            : 'not run'
      ],
      [
        'Copied to',
        copied.status === 'done'
          ? `${copied.text}${copied.dry ? ' (dry run)' : ''}`
          : 'not finalized'
      ]
    ]
    setResults({ status: 'running', text: 'Writing…' })
    try {
      await studio.ship.results(name, title, rows)
      void queryClient.invalidateQueries({ queryKey: ['design', name] })
      setResults({ status: 'done', text: `"${title}" added to DESIGN.md`, title, rows })
    } catch (e) {
      setResults({ status: 'failed', text: errorText(e) })
    }
  }

  const message = `${name}: ship ${built ? stem(built.path) : ''}`.trim()
  async function runCommit(really: boolean): Promise<void> {
    setCommit({ status: 'running', text: really ? 'Committing…' : 'Reading git status…' })
    try {
      const out = await studio.ship.commit(name, message, !really)
      if (!really && !dry) {
        // the confirm shows what would go in, then commits
        setPending(out)
        setCommit(IDLE)
        setConfirm('commit')
        return
      }
      setCommit({
        status: 'done',
        text: really ? `committed as "${message}", not pushed` : 'dry run: git status below',
        output: (really ? '' : 'dry run, would commit:\n') + out.trim()
      })
    } catch (e) {
      setCommit({ status: 'failed', text: errorText(e) })
    }
  }

  async function deleteRejected(): Promise<void> {
    let n = 0
    for (const p of rejected.paths)
      await studio.builds
        .deleteVersion(p)
        .then(() => n++)
        .catch((e) => toast.error(`${p}: ${errorText(e)}`))
    void queryClient.invalidateQueries({ queryKey: ['builds'] })
    setDeleted(n)
    toast.success(`${n} rejected ${n === 1 ? 'variant' : 'variants'} moved to the Recycle Bin`)
  }

  const run = (spec: JobSpec): void =>
    void studio.jobs.run(spec).catch((e) => toast.error(errorText(e)))

  return {
    availability,
    build,
    settings,
    targetPack,
    dry,
    setDry,
    selected,
    setSelected,
    setup,
    reload,
    copied,
    results,
    commit,
    deleted,
    confirm,
    setConfirm,
    pending,
    check,
    full,
    linter,
    lintActive,
    lint,
    problems,
    f,
    built,
    busy,
    bill,
    rare,
    engine,
    gitOk,
    noFolder,
    rejected,
    variant,
    logOf,
    connect,
    reloadCheck,
    runSteps,
    finalize,
    writeResults,
    message,
    runCommit,
    deleteRejected,
    run
  }
}
