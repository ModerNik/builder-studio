// First-run setup: a guided rail of six steps in the app frame (title bar with the Setup crumb, no search).
// Continue saves the step's draft; Skip drops it; Back and the rail keep it.
import { useEffect, type ReactElement } from 'react'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/shared/ui/primitives/button'
import { IconButton } from '@/shared/ui/primitives/icon-button'
import { InlineNotice } from '@/shared/ui/feedback/Alert'
import { Stepper, type Step as StepperStep } from '@/shared/ui/data/progress'
import { TitleBar } from '@/widgets/workbench-shell/ui/TitleBar'
import { WorkbenchShell } from '@/widgets/workbench-shell/ui/WorkbenchShell'
import { type Settings } from '@shared/api'
import { SETUP_STEPS } from '@shared/constants'
import { STEPS } from '../model/steps'
import { useSetup } from '../model/setup'
import { Welcome } from './Welcome'
import { Workspace } from './Workspace'
import { BuildTools } from './BuildTools'
import { Minecraft } from './Minecraft'
import { Assistant } from './Assistant'
import { Ready } from './Ready'

type Step = Settings['setup']['step']

export function Setup(): ReactElement {
  const {
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
  } = useSetup()
  useEffect(() => document.getElementById('setup-heading')?.focus(), [step])
  const steps: StepperStep[] = SETUP_STEPS.map((s, i) => ({
    id: s,
    label: STEPS[s].label,
    optional: STEPS[s].optional,
    status:
      s === step
        ? 'current'
        : skipped.has(s)
          ? 'skipped'
          : done.has(s) || i <= top
            ? 'done'
            : 'upcoming',
    detail: skipped.has(s)
      ? 'Set up later'
      : s === 'workspace' && saved.workspace && s !== step
        ? saved.workspace.split(/[\\/]/).pop()
        : s === 'workspace'
          ? 'Required'
          : undefined
  }))
  const primary =
    step === 'welcome' ? 'Get started' : step === 'verify' ? 'Open Builder Studio' : 'Continue'

  return (
    <WorkbenchShell
      layoutId="setup"
      titleBar={<TitleBar crumbs={[{ label: 'Setup' }]} />}
      screens={[]}
      screen=""
      onScreenChange={() => {}}
      panels={[]}
      skipLabel="Skip to the setup step"
    >
      <div className="flex h-full min-h-0 flex-col md:flex-row">
        <aside
          aria-label="Setup steps"
          className="flex shrink-0 flex-col gap-4 border-border-default bg-surface-panel px-4 py-3 max-md:border-b md:w-18 md:border-e md:px-2 md:pt-8 md:pb-5 lg:w-72 lg:px-4"
        >
          <p className="text-sm font-medium text-fg-secondary max-lg:sr-only">Setup progress</p>
          <Stepper
            label="Setup progress"
            steps={steps}
            orientation="vertical"
            className="max-lg:hidden"
            onSelect={(id) => go(id as Step, 'move')}
          />
          <Stepper
            label="Setup progress"
            steps={steps}
            compact
            className="max-md:hidden lg:hidden"
            onSelect={(id) => go(id as Step, 'move')}
          />
          <Stepper
            label="Setup progress"
            steps={steps}
            orientation="horizontal"
            className="md:hidden"
            onSelect={(id) => go(id as Step, 'move')}
          />
          <p className="mt-auto text-sm text-fg-muted max-lg:hidden">
            Your choices are saved each time you continue. Everything here can be changed later in
            Settings.
          </p>
        </aside>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <section className="min-h-0 flex-1 overflow-auto px-4 pt-8 pb-10 sm:px-8 md:pt-14 xl:px-16">
            <div className="flex max-w-160 flex-col gap-6">
              {step === 'welcome' && <Welcome again={again} delivery={delivery.data} />}
              {step === 'workspace' && (
                <Workspace {...props} saved={saved.workspace} suggestion={suggestion.data ?? ''} />
              )}
              {step === 'runtime' && (
                <BuildTools
                  state={runtime}
                  pending={preparation.isPending}
                  error={preparation.error}
                  delivery={delivery.data}
                  prepare={prepare}
                />
              )}
              {step === 'minecraft' && <Minecraft {...props} />}
              {step === 'ai' && <Assistant {...props} />}
              {step === 'verify' && <Ready skipped={skipped} />}
              {error && <InlineNotice tone="danger">{error}</InlineNotice>}
            </div>
          </section>
          <footer className="flex shrink-0 items-center gap-2 border-t border-border-default px-4 py-4 sm:px-8 xl:px-16">
            {step !== 'welcome' && step !== 'verify' && (
              <>
                <Button
                  variant="ghost"
                  className="max-sm:hidden"
                  disabled={blocked}
                  onClick={() => go(SETUP_STEPS[index - 1], 'move')}
                >
                  <ChevronLeft aria-hidden className="rtl:rotate-180" />
                  Back
                </Button>
                <IconButton
                  label="Back"
                  className="sm:hidden"
                  disabled={blocked}
                  onClick={() => go(SETUP_STEPS[index - 1], 'move')}
                >
                  <ChevronLeft aria-hidden className="rtl:rotate-180" />
                </IconButton>
              </>
            )}
            <div className="flex-1" />
            {STEPS[step].optional && (
              <Button variant="secondary" disabled={blocked} onClick={() => go(nextStep, 'skip')}>
                Skip for now
              </Button>
            )}
            <Button
              variant="primary"
              disabled={!valid || blocked}
              onClick={() => go(nextStep, 'continue', step === 'verify')}
            >
              {primary}
            </Button>
          </footer>
        </div>
      </div>
    </WorkbenchShell>
  )
}
