import type { ReactElement } from 'react'
import { Boxes, Cpu, Folder, Sparkles } from 'lucide-react'
import { InlineNotice } from '@/shared/ui/feedback/Alert'
import type { RuntimeDelivery } from '@shared/api'

const POINTS = [
  {
    icon: Folder,
    title: 'Your folders are ready to use',
    text: 'Builds, assets and exports get their own folders in your user data. You can choose different locations.'
  },
  {
    icon: Cpu,
    title: 'Builds run on your PC',
    text: 'Setup prepares the build engine, Git and a preview browser automatically.'
  },
  {
    icon: Sparkles,
    title: 'AI is optional',
    text: 'Connect Claude, Codex or a local Ollama model now or any time later.'
  }
]

export function Welcome({
  again,
  delivery
}: {
  again: boolean
  delivery?: RuntimeDelivery
}): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <span className="grid size-12 place-items-center rounded-lg bg-accent-subtle">
        <Boxes className="size-6 text-accent-text" aria-hidden />
      </span>
      <div className="flex flex-col gap-2">
        <h1 id="setup-heading" tabIndex={-1} className="text-3xl font-semibold outline-none">
          {again ? 'Run setup again' : 'Let’s get Builder Studio ready'}
        </h1>
        <p className="text-pretty text-fg-secondary">
          Design Minecraft builds, preview them in 3D and export schematics. Keep the default
          folders and we’ll prepare them for you. Minecraft game files are optional during setup;
          add them whenever you want the 3D view.
        </p>
      </div>
      {again && (
        <InlineNotice tone="info">
          Running setup again keeps your builds and settings. Steps that are already done show as
          done; change only what you need.
        </InlineNotice>
      )}
      {delivery && (
        <InlineNotice tone="info">
          {delivery.mode === 'bundled'
            ? 'Engine and Git are included in this installer. A preview browser downloads only if needed.'
            : 'Setup downloads Engine and Git if needed. Keep your internet connection on while tools are prepared.'}
        </InlineNotice>
      )}
      <ul className="flex flex-col gap-4">
        {POINTS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-md border border-border-default bg-surface-raised">
              <Icon className="size-4 text-fg-secondary" aria-hidden />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">{title}</span>
              <span className="text-fg-secondary">{text}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
