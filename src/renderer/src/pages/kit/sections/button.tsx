import { useState, type ReactElement } from 'react'
import { DownloadIcon, PlayIcon, Trash2Icon } from 'lucide-react'
import { Button } from '@/shared/ui/primitives/button'
import { forceFocus, Guidance, LONG, RTL_TEXT, Specimen, Specimens } from '../specimen'

export const meta = { group: 'Actions', title: 'Button' }

const variants = ['primary', 'secondary', 'outline', 'ghost', 'destructive', 'link'] as const
// static stand-ins for pointer states, so every state is visible at once
const hover: Record<(typeof variants)[number], string> = {
  primary: 'bg-accent-solid-hover',
  secondary: 'bg-surface-active',
  outline: 'bg-surface-hover',
  ghost: 'bg-surface-hover text-fg',
  destructive: 'bg-danger-solid-hover',
  link: 'underline'
}
const pressed: Record<(typeof variants)[number], string> = {
  primary: 'bg-accent-solid-active scale-(--press-scale-primary)',
  secondary: 'bg-surface-active',
  outline: 'bg-surface-active',
  ghost: 'bg-surface-active text-fg',
  destructive: 'bg-danger-solid-hover',
  link: 'underline'
}

export default function ButtonSection(): ReactElement {
  const [busy, setBusy] = useState(false)
  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-x-4 border-spacing-y-2 text-start">
          <thead>
            <tr className="text-2xs text-fg-muted">
              {['', 'Rest', 'Hover', 'Pressed', 'Focus', 'Disabled', 'Loading'].map((h) => (
                <th key={h} className="text-start font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {variants.map((v) => (
              <tr key={v}>
                <th className="pe-2 text-start text-xs font-medium text-fg-secondary">{v}</th>
                <td>
                  <Button variant={v}>Save</Button>
                </td>
                <td>
                  <Button variant={v} className={hover[v]} tabIndex={-1}>
                    Save
                  </Button>
                </td>
                <td>
                  <Button variant={v} className={pressed[v]} tabIndex={-1}>
                    Save
                  </Button>
                </td>
                <td>
                  <Button variant={v} className={forceFocus} tabIndex={-1}>
                    Save
                  </Button>
                </td>
                <td>
                  <Button variant={v} disabled>
                    Save
                  </Button>
                </td>
                <td>
                  <Button variant={v} loading>
                    Save
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Specimens title="Sizes">
        <Specimen label="xs">
          <Button size="xs">Apply</Button>
        </Specimen>
        <Specimen label="sm">
          <Button size="sm">Apply</Button>
        </Specimen>
        <Specimen label="default">
          <Button>Apply</Button>
        </Specimen>
        <Specimen label="lg">
          <Button size="lg">Generate draft</Button>
        </Specimen>
      </Specimens>
      <Specimens title="With icons">
        <Specimen label="leading icon">
          <Button>
            <PlayIcon />
            Generate draft
          </Button>
        </Specimen>
        <Specimen label="outline + icon">
          <Button variant="outline">
            <DownloadIcon />
            Export .litematic
          </Button>
        </Specimen>
        <Specimen label="destructive + icon">
          <Button variant="destructive">
            <Trash2Icon />
            Delete build
          </Button>
        </Specimen>
        <Specimen label="loading, live (click)">
          <Button
            loading={busy}
            onClick={() => {
              setBusy(true)
              setTimeout(() => setBusy(false), 2000)
            }}
          >
            {busy ? 'Exporting…' : 'Export'}
          </Button>
        </Specimen>
      </Specimens>
      <Specimens title="Long text and RTL">
        <Specimen label="truncates in a narrow box" className="w-48">
          <Button variant="outline" className="w-full justify-start">
            <span className="truncate">{LONG}</span>
          </Button>
        </Specimen>
        <Specimen label="RTL">
          <div dir="rtl">
            <Button>
              <PlayIcon />
              {RTL_TEXT}
            </Button>
          </div>
        </Specimen>
        <Specimen label="invalid (aria-invalid)">
          <Button variant="outline" aria-invalid>
            Pick a world
          </Button>
        </Specimen>
      </Specimens>
      <Guidance>
        One primary button per view (the Verdigris Budget Rule). Press is colour-only; only primary scales to
        0.97. Loading keeps the button focusable and its width, sets aria-busy and ignores clicks. Name the
        action: “Generate draft”, not “OK”.
      </Guidance>
    </div>
  )
}
