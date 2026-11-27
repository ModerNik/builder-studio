// The command palette (Ctrl K): builds, the current build's actions and app commands.
// Loaded on first open: cmdk and the store subscriptions below stay out of the boot path.
import type { ReactElement } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  BookOpen,
  Boxes,
  Camera,
  Download,
  FlaskConical,
  Play,
  Plus,
  Rocket,
  ScanSearch,
  Settings as SettingsIcon,
  Square
} from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut
} from '@/shared/ui/primitives/command'
import { useBuilds } from '@/entities/build/model/builds'
import { cancelJob, useJobs } from '@/entities/job/model/jobs'
import { useReview } from '@/entities/review/model/review'
import { STATE_LABEL, buildState, useGalleryDialog } from '@/entities/build/model/gallery'
import { runJob, useRunOptions } from '@/entities/job/model/run'
import { openRenderStudio } from '@/features/render-studio/model/store'

export default function Palette({
  open,
  setOpen,
  current
}: {
  open: boolean
  setOpen: (o: boolean) => void
  current: string | null
}): ReactElement {
  const navigate = useNavigate()
  const builds = useBuilds().data ?? []
  const jobs = useJobs((s) => s.jobs)
  const drafts = useReview((s) => s.drafts)
  const opts = useRunOptions((s) => (current ? s.byBuild[current] : undefined)) ?? {}
  const go = (f: () => void) => () => {
    setOpen(false)
    f()
  }
  const running = jobs.filter((j) => j.state === 'running')
  const busy = new Set(running.map((j) => j.spec.build))
  const reviews = new Set(
    Object.entries(drafts)
      .filter(([, d]) => d.requestId)
      .map(([b]) => b)
  )
  const labelOf = (id: string): string => builds.find((b) => b.name === id)?.displayName ?? id
  const currentLabel = current ? labelOf(current) : null
  const gallery = (open: 'new' | 'import'): void => {
    void navigate({ to: '/' })
    useGalleryDialog.setState({ open })
  }
  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search builds or run a command" />
      <CommandList>
        <CommandEmpty>Nothing found.</CommandEmpty>
        {current && (
          <CommandGroup heading={currentLabel ?? current}>
            {(['proto', 'check'] as const).map((part) => {
              const Icon = part === 'proto' ? Play : ScanSearch
              return (
                <CommandItem key={part} onSelect={go(() => runJob(current, part, opts))}>
                  <Icon aria-hidden="true" />
                  {{ proto: 'Generate draft', check: 'Check build' }[part]}: {currentLabel}
                  {part === 'proto' && <CommandShortcut>Ctrl Enter</CommandShortcut>}
                </CommandItem>
              )
            })}
            <CommandItem
              onSelect={go(
                () => void navigate({ to: '/build/$name/ship', params: { name: current } })
              )}
            >
              <Rocket aria-hidden="true" />
              Export: {currentLabel}
            </CommandItem>
            <CommandItem onSelect={go(() => openRenderStudio({ build: current }))}>
              <Camera aria-hidden="true" />
              Render images: {currentLabel}
              <CommandShortcut>Ctrl Shift E</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        )}
        {running.length > 0 && (
          <CommandGroup heading="Running">
            {running.map((j) => (
              <CommandItem key={j.id} onSelect={go(() => cancelJob(j.id))}>
                <Square aria-hidden="true" />
                Stop build activity: {labelOf(j.spec.build)}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        <CommandGroup heading="Builds">
          {builds.map((b) => {
            const state = STATE_LABEL[buildState(b, busy, reviews)]
            const display = b.displayName || b.name
            return (
              <CommandItem
                key={b.name}
                value={`${display} ${b.name} ${state} ${b.status[0] ?? ''}`}
                onSelect={go(() => void navigate({ to: '/build/$name', params: { name: b.name } }))}
              >
                <span className="truncate font-medium">{display}</span>
                <span className="shrink-0 text-fg-muted">· {state}</span>
              </CommandItem>
            )
          })}
        </CommandGroup>
        <CommandGroup heading="Commands">
          <CommandItem onSelect={go(() => gallery('new'))}>
            <Plus aria-hidden="true" />
            New build…
          </CommandItem>
          <CommandItem onSelect={go(() => gallery('import'))}>
            <Download aria-hidden="true" />
            Import builds…
          </CommandItem>
          <CommandItem onSelect={go(() => void navigate({ to: '/settings' }))}>
            <SettingsIcon aria-hidden="true" />
            Open Settings
            <CommandShortcut>Ctrl ,</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={go(() => void navigate({ to: '/' }))}>
            <Boxes aria-hidden="true" />
            All builds
          </CommandItem>
          <CommandItem onSelect={go(() => void navigate({ to: '/labs' }))}>
            <FlaskConical aria-hidden="true" />
            Labs: palette, kit catalog, prefabs
          </CommandItem>
          <CommandItem onSelect={go(() => void navigate({ to: '/docs' }))}>
            <BookOpen aria-hidden="true" />
            Documentation
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
