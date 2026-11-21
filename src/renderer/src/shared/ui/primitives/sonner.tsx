import * as React from 'react'
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
  XIcon
} from 'lucide-react'
import { Toaster as Sonner, type ToasterProps } from 'sonner'
import { useResolvedTheme } from '@/shared/lib/theme'

// Toasts sit on the overlay surface; the type shows as a coloured icon plus its words, never colour alone.
const Toaster = ({ toastOptions, ...props }: ToasterProps): React.ReactElement => {
  const theme = useResolvedTheme()

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      gap={8}
      icons={{
        success: <CircleCheckIcon className="size-4 text-success-text" />,
        info: <InfoIcon className="size-4 text-info-text" />,
        warning: <TriangleAlertIcon className="size-4 text-warning-text" />,
        error: <OctagonXIcon className="size-4 text-danger-text" />,
        loading: <Loader2Icon className="size-4 animate-spin text-fg-muted motion-reduce:animate-none" />,
        close: <XIcon className="size-3" />
      }}
      style={
        {
          '--normal-bg': 'var(--surface-overlay)',
          '--normal-text': 'var(--fg)',
          '--normal-border': 'var(--border-default)',
          '--border-radius': 'var(--radius-lg)',
          '--width': 'min(22.5rem, calc(100vw - 2rem))'
        } as React.CSSProperties
      }
      toastOptions={{
        ...toastOptions,
        classNames: {
          toast: 'font-sans! text-base! shadow-md! gap-2.5! items-start! px-3! py-2.5!',
          title: 'font-medium! wrap-anywhere',
          description: 'text-sm! text-fg-secondary! wrap-anywhere',
          icon: 'mt-0.5!',
          actionButton:
            'h-(--density-control-sm)! rounded-md! bg-accent-solid! px-2.5! text-sm! font-medium! text-accent-on-solid! focus-visible:outline-2! focus-visible:outline-offset-2! focus-visible:outline-focus!',
          cancelButton:
            'h-(--density-control-sm)! rounded-md! bg-surface-hover! px-2.5! text-sm! font-medium! text-fg!',
          closeButton:
            'border-border-default! bg-surface-overlay! text-fg-secondary! hover:bg-surface-hover!',
          ...toastOptions?.classNames
        }
      }}
      {...props}
    />
  )
}

export { Toaster }
