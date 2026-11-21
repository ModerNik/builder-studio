// The UI kit catalogue (/kit): every component of the design system in every state, both themes.
// Each file in ./sections adds one entry: `export const meta = { group, title }` and a default component.
import { useEffect, useMemo, useState, type ComponentType, type ReactElement } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowLeftIcon, SearchIcon } from 'lucide-react'
import { useResolvedTheme } from '@/shared/lib/theme'
import { cn } from '@/shared/lib/utils'
import { Input } from '@/shared/ui/primitives/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from '@/shared/ui/primitives/select'
import { SegmentedControl, SegmentedControlItem } from '@/shared/ui/primitives/toggle-group'
import { TooltipProvider } from '@/shared/ui/primitives/tooltip'

type Section = { meta: { group: string; title: string }; default: ComponentType }
const sections = Object.values(import.meta.glob<Section>('./sections/*.tsx', { eager: true }))
  .filter((s) => s.meta)
  .sort(
    (a, b) => a.meta.group.localeCompare(b.meta.group) || a.meta.title.localeCompare(b.meta.title)
  )
const slug = (title: string): string => `kit-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
// the router uses the URL hash, so section links scroll instead of setting #ids. container: 'nearest'
// scrolls only the kit's own pane; without it the window scrolls too and the title bar slides out of view.
// (Not in TypeScript's DOM types yet, hence the cast.)
const jump = (title: string): void =>
  document
    .getElementById(slug(title))
    ?.scrollIntoView({ block: 'start', container: 'nearest' } as ScrollIntoViewOptions)

type Density = 'auto' | 'touch'

export function Kit(): ReactElement {
  const theme = useResolvedTheme()
  const [query, setQuery] = useState('')
  const [density, setDensity] = useState<Density>('auto')

  // previews only: the saved theme comes back on reload or when the OS theme changes; density resets on leave
  useEffect(() => {
    const root = document.documentElement
    if (density === 'touch') root.dataset.density = 'touch'
    else delete root.dataset.density
    return () => {
      delete root.dataset.density
    }
  }, [density])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q
      ? sections.filter((s) => `${s.meta.group} ${s.meta.title}`.toLowerCase().includes(q))
      : sections
  }, [query])
  const groups = [...new Set(shown.map((s) => s.meta.group))]

  return (
    <TooltipProvider>
      <div className="flex h-full min-h-0">
        <nav
          aria-label="Kit sections"
          className="flex w-56 shrink-0 flex-col gap-3 overflow-auto border-e border-border-subtle bg-surface-panel p-3 max-md:hidden"
        >
          <Link
            to="/settings"
            search={{ section: 'advanced' }}
            className="focus-ring inline-flex items-center gap-1 self-start rounded-xs text-sm text-fg-muted can-hover:text-fg"
          >
            <ArrowLeftIcon aria-hidden className="size-3.5 rtl:rotate-180" />
            Settings
          </Link>
          <Input
            type="search"
            aria-label="Filter components"
            placeholder="Filter components"
            leading={<SearchIcon aria-hidden />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onClear={() => setQuery('')}
          />
          {groups.map((g) => (
            <div key={g} className="flex flex-col">
              <p className="px-2 pt-2 pb-1 text-xs font-medium text-fg-muted">{g}</p>
              {shown
                .filter((s) => s.meta.group === g)
                .map((s) => (
                  <button
                    key={s.meta.title}
                    type="button"
                    onClick={() => jump(s.meta.title)}
                    className="focus-ring flex h-(--density-row) cursor-pointer items-center truncate rounded-sm px-2 text-start text-fg-secondary can-hover:bg-surface-hover can-hover:text-fg"
                  >
                    {s.meta.title}
                  </button>
                ))}
            </div>
          ))}
          {shown.length === 0 && <p className="px-2 text-sm text-fg-muted">No match</p>}
        </nav>
        <main id="kit-main" className="min-w-0 flex-1 overflow-auto">
          <header className="sticky top-0 z-sticky flex flex-wrap items-center gap-3 border-b border-border-subtle bg-surface px-6 py-3 max-md:px-4">
            <h1 className="me-auto text-xl">UI kit</h1>
            <div className="flex w-full gap-2 md:hidden">
              <Input
                type="search"
                aria-label="Filter components"
                placeholder="Filter"
                leading={<SearchIcon aria-hidden />}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onClear={() => setQuery('')}
                className="flex-1"
              />
              <Select value="" onValueChange={jump}>
                <SelectTrigger aria-label="Go to component" className="w-40">
                  <SelectValue placeholder="Go to…" />
                </SelectTrigger>
                <SelectContent align="end">
                  {groups.map((g) => (
                    <SelectGroup key={g}>
                      <SelectLabel>{g}</SelectLabel>
                      {shown
                        .filter((s) => s.meta.group === g)
                        .map((s) => (
                          <SelectItem key={s.meta.title} value={s.meta.title}>
                            {s.meta.title}
                          </SelectItem>
                        ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <SegmentedControl
              aria-label="Theme preview"
              size="sm"
              value={theme}
              onValueChange={(v) => document.documentElement.classList.toggle('dark', v === 'dark')}
            >
              <SegmentedControlItem value="dark">Dark</SegmentedControlItem>
              <SegmentedControlItem value="light">Light</SegmentedControlItem>
            </SegmentedControl>
            <SegmentedControl
              aria-label="Density preview"
              size="sm"
              value={density}
              onValueChange={(v) => setDensity(v as Density)}
            >
              <SegmentedControlItem value="auto">Compact</SegmentedControlItem>
              <SegmentedControlItem value="touch">Touch</SegmentedControlItem>
            </SegmentedControl>
          </header>
          <div className="flex flex-col gap-12 px-6 py-6 max-md:px-4">
            {sections.length === 0 && (
              <p className="text-fg-muted">No components yet. Add files to src/renderer/src/pages/kit/sections.</p>
            )}
            {sections.length > 0 && shown.length === 0 && (
              <p className="text-fg-muted">No component matches “{query}”.</p>
            )}
            {shown.map(({ meta, default: Demo }) => (
              <section
                key={meta.title}
                id={slug(meta.title)}
                aria-labelledby={`${slug(meta.title)}-title`}
                className={cn('flex scroll-mt-20 flex-col gap-4')}
              >
                <header className="flex items-baseline gap-2 border-b border-border-subtle pb-2">
                  <h2 id={`${slug(meta.title)}-title`} className="text-lg">
                    {meta.title}
                  </h2>
                  <span className="text-xs text-fg-muted">{meta.group}</span>
                </header>
                <Demo />
              </section>
            ))}
          </div>
        </main>
      </div>
    </TooltipProvider>
  )
}
