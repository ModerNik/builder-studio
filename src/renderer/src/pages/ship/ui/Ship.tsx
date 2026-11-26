// Export (G6-5-EX, checklist with a detail pane): the ten steps stay one checklist, run top to bottom, with the
// action at the end of each row. Clicking a row shows what that step produced beside it (below on tablet, in a
// Sheet on phone): the job log, the bill as a table, the results rows, the git output. The full build finalizes
// into a staging folder; Finalize and Git commit each ask first, and the dry run sends both to a temp folder
// and `git status`. State and steps: ../model/useExport.ts.
import { useRef, useState, type KeyboardEvent, type ReactElement, type ReactNode } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { Button } from '@/shared/ui/primitives/button'
import { Badge } from '@/shared/ui/primitives/badge'
import { Field } from '@/shared/ui/primitives/field'
import { Switch } from '@/shared/ui/primitives/switch'
import { Skeleton } from '@/shared/ui/primitives/skeleton'
import { DataTable, type Column } from '@/shared/ui/primitives/data-table'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/ui/primitives/sheet'
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
import { ConfirmDestructive } from '@/shared/ui/feedback/ConfirmDestructive'
import { PageHeader } from '@/shared/ui/layout/PageHeader'
import { Checklist, ChecklistRow, type CheckStatus } from '@/shared/ui/data/progress'
import { KeyValueList } from '@/shared/ui/data/values'
import { LogViewer } from '@/shared/ui/code/LogViewer'
import { CodeBlock } from '@/shared/ui/code/CodeBlock'
import { useWorkbench } from '@/widgets/workbench-shell/model/context'
import { endedText, isRare, jobStatus, lintText, percent, stacks } from '../model/ship'
import { useExport } from '../model/useExport'
import { checkLabel } from '@/entities/build/model/workspace'
import { INFO, isLintRuleEnabled } from '@/shared/lib/format'

const TITLES = [
  'Connect and check setup',
  'Lint zero',
  'Full build',
  'Hollow count',
  'Bill of materials',
  'Reload check',
  'Finalize',
  'Results table',
  'Git commit',
  'Rejected variants'
]

export function Ship(): ReactElement {
  const { name } = useParams({ from: '/build/$name/ship' })
  return <Export key={name} name={name} />
}

function Export({ name }: { name: string }): ReactElement {
  const { tier } = useWorkbench()
  const [sheetOpen, setSheetOpen] = useState(false)
  const pane = useRef<HTMLElement>(null)
  const {
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
  } = useExport(name)

  const act = (label: string, onClick: () => void, disabled = false): ReactNode => (
    <Button size="sm" variant="outline" disabled={disabled} onClick={onClick}>
      {label}
    </Button>
  )

  // ── the ten rows ──
  const lintFailed =
    lintActive && (check?.state === 'failed' || (problems !== null && problems > 0))
  const buildOff = busy || (lintActive && problems !== 0) || !engine
  const rows: { status: CheckStatus; label: string; detail?: ReactNode; action?: ReactNode }[] = [
    {
      label: 'Connect and check setup',
      status: setup.status,
      detail: setup.text,
      action: act('Check', () => void connect(), busy)
    },
    {
      label: 'Lint zero',
      status: !lintActive ? 'skipped' : jobStatus(check, problems === 0),
      detail: !lintActive ? (
        <>
          {!linter.enabled ? 'Linter is off.' : 'All lint rules are off.'}{' '}
          <Link
            to="/settings"
            search={{ section: 'linter' }}
            className="font-sans text-accent-text underline-offset-4 can-hover:hover:underline"
          >
            Open Settings › Linter
          </Link>
        </>
      ) : (
        <span className={lintFailed ? 'text-danger-text' : undefined}>
          {lint && (problems === 0 ? 'no problems' : lintText(lint.counts, linter.rules))}
          {check?.state === 'failed' && ` job failed (exit ${check.code})`}
        </span>
      ),
      action: lintActive
        ? act('Run check', () => run({ part: 'check', build: name }), busy || !engine)
        : undefined
    },
    {
      label: 'Full build (finalizes into a staging folder)',
      status: jobStatus(full),
      detail:
        full?.state === 'running'
          ? `${full.stage ?? 'starting'}…`
          : built
            ? `${built.path} ${built.shape.join('×')}, paste at ${built.paste.join(', ')}${tier === 'phone' ? '' : `; ${f.done?.seconds ?? '?'}s`}`
            : full?.state === 'failed'
              ? `job failed (exit ${full.code}): ${logOf(full).at(-1) ?? ''}`
              : lintActive && problems !== 0
                ? 'Lint must be zero first'
                : undefined,
      action: act(
        'Build',
        () => run({ part: 'full', build: name, ship: true, noRender: !targetPack.data }),
        buildOff
      )
    },
    {
      label: 'Hollow count',
      status: built ? (f.blocks ? 'done' : 'failed') : 'idle',
      detail:
        built && f.blocks
          ? `${f.blocks.total.toLocaleString()} blocks, ${(f.blocks.hidden_removed ?? 0).toLocaleString()} hidden removed (${percent(f.blocks.hidden_removed ?? 0, f.blocks.total)}%)`
          : undefined
    },
    {
      label: 'Bill of materials, rare blocks flagged',
      status: built && bill ? (rare.length ? 'warning' : 'done') : 'idle',
      detail:
        built && bill ? (
          <>
            {bill.total.toLocaleString()} blocks
            {rare.length ? (
              <span className="text-warning-text">
                {tier === 'phone'
                  ? ` · ${rare.length} rare`
                  : ` · rare: ${rare.map(([s, c]) => `${s.replace('minecraft:', '')} ${c.toLocaleString()}`).join(', ')}`}
              </span>
            ) : (
              ' · no rare blocks'
            )}
          </>
        ) : undefined
    },
    {
      label: 'Reload check (bridge reads the file back)',
      status: reload.status,
      detail: reload.text,
      action: act(
        'Reload',
        () => void reloadCheck(),
        busy || !built || !engine || reload.status === 'running'
      )
    },
    {
      label: dry ? 'Finalize (dry run: a temp folder)' : 'Finalize into the schematics folder',
      status: noFolder ? 'warning' : copied.status,
      detail: noFolder ? (
        <>
          Set the Exported schematics folder before a real Finalize. A dry run still works.{' '}
          <Link
            to="/settings"
            search={{ section: 'minecraft' }}
            className="font-sans text-accent-text underline-offset-4 can-hover:hover:underline"
          >
            Open Settings › Minecraft
          </Link>
        </>
      ) : (
        `${copied.text}${copied.status === 'done' && copied.dry ? ' (dry run)' : ''}`
      ),
      action: noFolder
        ? undefined
        : act(
            'Finalize…',
            () => setConfirm('finalize'),
            busy || !built || (!dry && !availability?.features.export.ok)
          )
    },
    {
      label: 'Results table in the DESIGN.md log',
      status: results.status,
      detail: results.text,
      action: act('Write', () => void writeResults(), !built || results.status === 'running')
    },
    {
      label: dry
        ? `Git commit (dry run: git status of builds/${name})`
        : `Git commit builds/${name}`,
      status: gitOk ? commit.status : 'skipped',
      detail: gitOk
        ? commit.text
        : 'Git isn’t available, so nothing is committed. Settings › Build tools sets it up.',
      action: gitOk ? act(dry ? 'Status' : 'Commit…', () => void runCommit(false), busy) : undefined
    },
    {
      label: 'Rejected variants to delete',
      status: !rejected.round ? 'skipped' : deleted !== null ? 'done' : 'idle',
      detail: !rejected.round
        ? 'No review with a pick yet, so nothing to delete.'
        : deleted !== null
          ? `review ${rejected.round.round} picked ${rejected.round.pick}: ${deleted} rejected ${deleted === 1 ? 'variant' : 'variants'} moved to the Recycle Bin`
          : rejected.paths.length
            ? `review ${rejected.round.round} picked ${rejected.round.pick}: ${rejected.paths.join(', ')}`
            : `review ${rejected.round.round} picked ${rejected.round.pick}; nothing left to delete`,
      action: rejected.round
        ? act('Delete…', () => setConfirm('reject'), !rejected.paths.length || busy)
        : undefined
    }
  ]

  const select = (n: number): void => {
    setSelected(n)
    if (tier === 'phone') setSheetOpen(true)
    else if (tier === 'tablet')
      requestAnimationFrame(() => pane.current?.scrollIntoView({ block: 'nearest' }))
  }
  // ↑ ↓ move between the rows' select buttons
  const onKey = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    const buttons = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('ol > li > button')]
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (at < 0) return
    e.preventDefault()
    const next =
      buttons[Math.min(Math.max(at + (e.key === 'ArrowDown' ? 1 : -1), 0), buttons.length - 1)]
    next.focus()
  }

  // ── the detail pane ──
  const billRows = [...(bill?.top ?? [])]
    .sort((a, b) => (tier === 'phone' ? Number(isRare(b[0])) - Number(isRare(a[0])) : 0))
    .map(([block, count]) => ({ block, count }))
  const billColumns: Column<{ block: string; count: number }>[] = [
    {
      key: 'block',
      header: 'Block',
      cell: (r) => <span className="font-mono">{r.block.replace('minecraft:', '')}</span>,
      sortValue: (r) => r.block
    },
    {
      key: 'count',
      header: 'Count',
      align: 'end',
      cell: (r) => r.count.toLocaleString(),
      sortValue: (r) => r.count
    },
    ...(tier === 'phone'
      ? []
      : [
          {
            key: 'stacks',
            header: 'Stacks',
            align: 'end' as const,
            cell: (r: { count: number }) => stacks(r.count)
          }
        ]),
    {
      key: 'rare',
      header: 'Rare',
      cell: (r) => (isRare(r.block) ? <Badge variant="warning">Rare</Badge> : null)
    }
  ]
  const shown = (bill?.top ?? []).reduce((s, [, c]) => s + c, 0)

  function detail(n: number): ReactNode {
    const nothing = <p className="text-sm text-fg-muted">Not run yet.</p>
    switch (n) {
      case 1:
        return setup.text ? (
          <p className="font-mono text-sm break-words">{setup.text}</p>
        ) : (
          <p className="text-sm text-fg-muted">
            Check asks again for the engine, rendering and the export destination.
          </p>
        )
      case 2:
        return !lintActive ? (
          <p className="text-sm text-fg-muted">
            {!linter.enabled
              ? 'Linter is turned off in Settings, so build checks are skipped.'
              : 'All lint rules are turned off in Settings, so build checks are skipped.'}
          </p>
        ) : check ? (
          <div className="flex flex-col gap-3">
            {lint && (
              <KeyValueList
                items={Object.entries(lint.counts).map(([k, c]) => ({
                  label: checkLabel(k),
                  value:
                    !INFO.has(k) && !isLintRuleEnabled(k, linter.rules) ? `${c} (off)` : String(c),
                  mono: true
                }))}
              />
            )}
            <LogViewer
              lines={logOf(check)}
              streaming={check.state === 'running'}
              label="Lint check log"
            />
          </div>
        ) : (
          nothing
        )
      case 3:
        return full ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-fg-secondary">
              {full.state === 'running'
                ? `${full.stage ?? 'Starting'}. Streaming: scroll up to pause.`
                : full.state === 'failed'
                  ? `Failed at ${endedText(full)}.`
                  : `Finished at ${endedText(full)}.`}
            </p>
            <LogViewer
              lines={logOf(full)}
              streaming={full.state === 'running'}
              label="Full build log"
              height="h-96"
            />
          </div>
        ) : lintActive && problems !== 0 ? (
          <p className="text-sm text-fg-muted">Lint must be zero first.</p>
        ) : (
          nothing
        )
      case 4:
        return built && f.blocks ? (
          <KeyValueList
            items={[
              { label: 'Blocks', value: f.blocks.total.toLocaleString() },
              { label: 'Hidden removed', value: (f.blocks.hidden_removed ?? 0).toLocaleString() },
              {
                label: 'Share removed',
                value: `${percent(f.blocks.hidden_removed ?? 0, f.blocks.total)}%`
              }
            ]}
          />
        ) : (
          nothing
        )
      case 5:
        return built && bill ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-fg-secondary">
              {bill.total.toLocaleString()} blocks after hollowing, from the full build. Rare blocks
              are slow or costly to gather in survival.
            </p>
            <DataTable
              label="Bill of materials"
              columns={billColumns}
              rows={billRows}
              getRowId={(r) => r.block}
              dense
              className="max-h-[60vh]"
            />
            {bill.total > shown && (
              <p className="text-sm text-fg-muted">
                {(bill.total - shown).toLocaleString()} more blocks.
                {!reload.bill && ' Top 30 only until the reload check reads the whole file.'}
              </p>
            )}
          </div>
        ) : (
          nothing
        )
      case 6:
        return reload.text ? (
          <p className="font-mono text-sm break-words">{reload.text}</p>
        ) : (
          nothing
        )
      case 7:
        return copied.text ? <p className="font-mono text-sm break-all">{copied.text}</p> : nothing
      case 8:
        return results.rows ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-fg-secondary">
              Added at the end of DESIGN.md as “{results.title}”. The Status block is untouched.{' '}
              <Link
                to="/build/$name/log"
                params={{ name }}
                className="text-accent-text underline-offset-4 can-hover:hover:underline"
              >
                Open in Design log
              </Link>
            </p>
            <KeyValueList items={results.rows.map(([label, value]) => ({ label, value }))} />
          </div>
        ) : results.text ? (
          <p className="font-mono text-sm">{results.text}</p>
        ) : (
          nothing
        )
      case 9:
        return commit.output ? (
          <CodeBlock code={commit.output} title="git" lineNumbers={false} />
        ) : commit.text ? (
          <p className="font-mono text-sm">{commit.text}</p>
        ) : (
          nothing
        )
      default:
        return rejected.paths.length ? (
          <ul className="font-mono text-sm">
            {rejected.paths.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-fg-muted">{rows[9].detail}</p>
        )
    }
  }
  const heading = `${selected} · ${TITLES[selected - 1]}`
  const badge =
    selected === 5 && rare.length ? <Badge variant="warning">{rare.length} rare</Badge> : null

  if (!build)
    return (
      <div className="flex flex-col gap-3 p-6" aria-busy="true" aria-label={`Loading ${name}…`}>
        {TITLES.map((t) => (
          <div key={t} className="flex items-center gap-3">
            <Skeleton className="size-4.5 rounded-full" />
            <Skeleton className="h-3 w-64" />
          </div>
        ))}
      </div>
    )

  const side = tier === 'wide' || tier === 'desktop'
  return (
    <div className="flex h-full min-w-0 flex-col overflow-auto">
      <PageHeader
        title="Export"
        description={
          tier === 'phone'
            ? `Takes ${variant} to your schematics folder, top to bottom.`
            : `Takes ${variant} from builds/${name}/out/ to your schematics folder, one step at a time, top to bottom.`
        }
        className="px-4 pt-4 sm:px-6"
        actions={
          <div className="flex max-w-95 flex-col items-stretch gap-3 max-sm:w-full">
            <Field
              label="Dry run"
              orientation="horizontal"
              hint={
                dry
                  ? 'Finalize copies to a temp folder and Git only shows git status.'
                  : 'Finalize writes into your schematics folder and Commit makes a real commit.'
              }
            >
              <Switch checked={dry} onCheckedChange={setDry} />
            </Field>
            <Button disabled={busy} onClick={() => void runSteps()}>
              Run steps 1 to 6
            </Button>
          </div>
        }
      />
      <div
        className={
          side ? 'flex min-h-0 flex-1 gap-6 px-6 pt-4 pb-6' : 'flex flex-col gap-4 px-4 pt-4 pb-6'
        }
      >
        <div onKeyDown={onKey} className={side ? 'w-150 shrink-0' : undefined}>
          <Checklist label="Export steps, top to bottom">
            {rows.map((r, i) => (
              <ChecklistRow
                key={i}
                n={i + 1}
                label={r.label}
                status={r.status}
                detail={r.detail || undefined}
                action={r.action}
                selected={tier !== 'phone' && selected === i + 1}
                onSelect={() => select(i + 1)}
              />
            ))}
          </Checklist>
        </div>
        {tier !== 'phone' && (
          <section
            ref={pane}
            aria-label={heading}
            className="flex min-w-0 flex-1 flex-col gap-3 rounded-lg border border-border-subtle bg-surface-raised p-4"
          >
            <h2 className="flex items-center gap-2 font-medium">
              {heading} {badge}
            </h2>
            {detail(selected)}
          </section>
        )}
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="overflow-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {heading} {badge}
            </SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4">{detail(selected)}</div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirm === 'finalize'} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalize?</AlertDialogTitle>
            <AlertDialogDescription>
              Copies <span className="font-mono">{built?.path.split('/').pop()}</span> to{' '}
              {dry ? (
                'a temp folder (dry run)'
              ) : (
                <span className="font-mono">{settings?.schematics}</span>
              )}
              , replacing a file of the same name there.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void finalize()}>Finalize</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={confirm === 'commit'} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Commit builds/{name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Stages and commits this build’s folder only, as “{message}”. Nothing else in the repo,
              and nothing is pushed:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <CodeBlock
            code={pending.trim() || '(nothing to commit)'}
            lineNumbers={false}
            maxHeight="max-h-48"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void runCommit(true)}>Commit</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ConfirmDestructive
        open={confirm === 'reject'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Delete ${rejected.paths.length} rejected ${rejected.paths.length === 1 ? 'variant' : 'variants'}?`}
        action="Move to Recycle Bin"
        onConfirm={() => void deleteRejected()}
      >
        <p>Each .litematic with its _3d/ and _ctx/ renders goes to the Recycle Bin:</p>
        <ul className="font-mono text-sm">
          {rejected.paths.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </ConfirmDestructive>
    </div>
  )
}
