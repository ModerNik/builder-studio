import {
  Circle,
  CircleCheck,
  CircleDashed,
  CirclePause,
  CircleSlash,
  CircleX,
  LoaderCircle,
  type LucideIcon
} from 'lucide-react'

/** Job and agent states (docs/DESIGN.md "Job and agent states"). */
export type JobState =
  'idle' | 'queued' | 'running' | 'awaiting-approval' | 'done' | 'failed' | 'cancelled'

export const JOB_STATES: JobState[] = [
  'idle',
  'queued',
  'running',
  'awaiting-approval',
  'done',
  'failed',
  'cancelled'
]

// each state differs by shape as well as colour; class names stay literal for Tailwind
export const STATE: Record<JobState, { label: string; icon: LucideIcon; fg: string; bg: string }> =
  {
    idle: { label: 'Idle', icon: Circle, fg: 'text-state-idle', bg: 'bg-state-idle-bg' },
    queued: {
      label: 'Queued',
      icon: CircleDashed,
      fg: 'text-state-queued',
      bg: 'bg-state-queued-bg'
    },
    running: {
      label: 'Running',
      icon: LoaderCircle,
      fg: 'text-state-running',
      bg: 'bg-state-running-bg'
    },
    'awaiting-approval': {
      label: 'Awaiting approval',
      icon: CirclePause,
      fg: 'text-state-awaiting-approval',
      bg: 'bg-state-awaiting-approval-bg'
    },
    done: { label: 'Done', icon: CircleCheck, fg: 'text-state-done', bg: 'bg-state-done-bg' },
    failed: { label: 'Failed', icon: CircleX, fg: 'text-state-failed', bg: 'bg-state-failed-bg' },
    cancelled: {
      label: 'Canceled',
      icon: CircleSlash,
      fg: 'text-state-cancelled',
      bg: 'bg-state-cancelled-bg'
    }
  }

/** Semantic tones for callouts, badges and notices. */
export type Tone = 'neutral' | 'accent' | 'info' | 'success' | 'warning' | 'danger'

export const TONE: Record<Tone, { text: string; bg: string; border: string; solid: string }> = {
  neutral: {
    text: 'text-fg-secondary',
    bg: 'bg-neutral-subtle',
    border: 'border-neutral-subtle-border',
    solid: 'bg-neutral-solid'
  },
  accent: {
    text: 'text-accent-text',
    bg: 'bg-accent-subtle',
    border: 'border-accent-subtle-border',
    solid: 'bg-accent-solid'
  },
  info: {
    text: 'text-info-text',
    bg: 'bg-info-subtle',
    border: 'border-info-subtle-border',
    solid: 'bg-info-solid'
  },
  success: {
    text: 'text-success-text',
    bg: 'bg-success-subtle',
    border: 'border-success-subtle-border',
    solid: 'bg-success-solid'
  },
  warning: {
    text: 'text-warning-text',
    bg: 'bg-warning-subtle',
    border: 'border-warning-subtle-border',
    solid: 'bg-warning-solid'
  },
  danger: {
    text: 'text-danger-text',
    bg: 'bg-danger-subtle',
    border: 'border-danger-subtle-border',
    solid: 'bg-danger-solid'
  }
}
