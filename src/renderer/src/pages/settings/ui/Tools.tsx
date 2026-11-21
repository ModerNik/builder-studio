// Settings › Build tools: install, repair or roll back the engine, preview browser and Git, Git in the
// workspace, and the name build history is signed with.
import { useState, type ReactElement } from 'react'
import { CircleCheck, CircleDashed, TriangleAlert } from 'lucide-react'
import { Button } from '@/shared/ui/primitives/button'
import { Field } from '@/shared/ui/primitives/field'
import { Input } from '@/shared/ui/primitives/input'
import { Progress } from '@/shared/ui/primitives/progress'
import { StatusBadge } from '@/shared/ui/status/StatusBadge'
import { SettingsPanel, SettingsRow } from '@/entities/settings/ui/Settings'
import { ErrorNotice } from './bits'
import { cancelRuntime } from '@/entities/availability/model/availability'
import { useRuntimeTools, useSaveIdentity } from '../model/tools'

const TOOLS: { key: 'engine' | 'browser' | 'git'; name: string; why: string }[] = [
  { key: 'engine', name: 'Build engine', why: 'Generates and checks builds.' },
  { key: 'browser', name: 'Preview browser', why: 'Needed for preview images and site pages.' },
  { key: 'git', name: 'Git', why: 'Keeps a history of every build version.' }
]

export function Tools(): ReactElement {
  const { delivery, state, checks, install, bootstrap } = useRuntimeTools()
  const blocked = state.busy || checks.isFetching
  const percent = state.total ? Math.round((100 * (state.received || 0)) / state.total) : null
  const mb = (n = 0): string => (n / 1048576).toFixed(1)
  // the page's one primary action: the first missing tool
  const firstMissing = TOOLS.find(({ key }) => checks.data && !checks.data[key].ok)?.key
  return (
    <div className="flex flex-col gap-4">
      <SettingsPanel>
        {TOOLS.map(({ key, name, why }) => {
          const check = checks.data?.[key]
          const running = state.busy && state.action === key
          return (
            <SettingsRow
              key={key}
              title={name}
              detail={`${why}${key !== 'browser' && delivery.data ? (delivery.data.mode === 'bundled' ? ' Included in this installer.' : ' Downloads if needed.') : ''}`}
              below={
                running && (
                  <div className="flex flex-col gap-1.5">
                    <Progress value={percent} aria-label={`Installing ${name.toLowerCase()}`} />
                    <p role="status" className="text-sm text-fg-secondary">
                      {state.stage}
                      {percent !== null &&
                        ` · ${mb(state.received)} of ${mb(state.total)} MB · ${percent}%`}
                    </p>
                  </div>
                )
              }
            >
              {running ? (
                <Button variant="ghost" onClick={cancelRuntime}>
                  Cancel
                </Button>
              ) : !check ? (
                <StatusBadge tone="neutral" icon={CircleDashed}>
                  {checks.isFetching ? 'Checking…' : 'Unknown'}
                </StatusBadge>
              ) : check.ok ? (
                <>
                  <StatusBadge tone="success" icon={CircleCheck}>
                    {key === 'git' ? 'Ready' : 'Installed'}
                  </StatusBadge>
                  {key !== 'git' && (
                    <Button variant="ghost" disabled={blocked} onClick={() => install.mutate(key)}>
                      Repair
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <StatusBadge tone="warning" icon={TriangleAlert}>
                    Not installed
                  </StatusBadge>
                  <Button
                    data-issue={key}
                    variant={key === firstMissing ? 'primary' : 'outline'}
                    disabled={blocked}
                    onClick={() => install.mutate(key)}
                  >
                    Install
                  </Button>
                </>
              )}
            </SettingsRow>
          )
        })}
        <SettingsRow
          title="Workspace history"
          detail="Sets up Git in the workspace again, after Git is installed or repaired."
          below={<ErrorNotice error={bootstrap.error} />}
        >
          <Button
            variant="outline"
            disabled={blocked || bootstrap.isPending || !checks.data?.git.ok}
            onClick={() => bootstrap.mutate()}
          >
            {bootstrap.isPending ? 'Initializing…' : 'Initialize workspace Git'}
          </Button>
        </SettingsRow>
        {checks.data?.git.ok && (
          <Identity
            disabled={state.busy}
            detail={checks.data.identity.ok ? checks.data.identity.detail : ''}
            onSaved={() => void checks.refetch()}
          />
        )}
        <SettingsRow
          title="Restore previous tools"
          detail={
            state.busy && state.action === 'rollback'
              ? `Restoring… ${state.stage}`
              : 'Go back to the tools you had before the last update, if builds stopped working after it.'
          }
        >
          <Button
            variant="outline"
            disabled={blocked || !checks.data?.previousRuntime}
            onClick={() => install.mutate('rollback')}
          >
            Restore previous
          </Button>
        </SettingsRow>
      </SettingsPanel>
      <ErrorNotice error={install.error ?? state.error ?? checks.error} />
    </div>
  )
}

function Identity({
  disabled,
  detail,
  onSaved
}: {
  disabled: boolean
  detail: string
  onSaved: () => void
}): ReactElement {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const save = useSaveIdentity(name, email, onSaved)
  return (
    <SettingsRow
      title={
        <span className="flex flex-wrap items-center gap-2">
          Your name for build history
          {!detail && (
            <StatusBadge tone="warning" icon={TriangleAlert}>
              Needs setup
            </StatusBadge>
          )}
        </span>
      }
      detail={
        detail
          ? `Current identity: ${detail}. Changes apply only to this workspace.`
          : 'Choose a name and email for this workspace’s build history.'
      }
      below={
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            save.mutate()
          }}
        >
          <Field label="Name" className="flex-[1_1_12rem]">
            <Input data-issue="identity" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Email" className="flex-[1_1_12rem]">
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Button
            type="submit"
            variant="outline"
            disabled={disabled || save.isPending || !name.trim() || !email.trim()}
          >
            Save name
          </Button>
          <ErrorNotice error={save.error} />
        </form>
      }
    />
  )
}
