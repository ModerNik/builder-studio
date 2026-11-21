import * as React from 'react'
import { cn } from '@/shared/lib/utils'
import { useFieldControl } from '@/shared/ui/primitives/field'
import { inputSurface } from '@/shared/ui/primitives/input'

const variants = {
  default: 'field-sizing-content max-h-60 min-h-16 px-2 py-1.5 leading-5',
  // raw-file editing (Design log): 14px mono, no wrapping, fills its pane and scrolls both ways
  code: 'h-full min-h-60 overflow-auto px-3 py-2 font-mono text-sm leading-5 whitespace-pre [tab-size:2]'
}

/**
 * Multi-line text. The default grows with its content (field-sizing) up to max-h, then scrolls. `code`
 * edits a raw file: mono, no wrapping, no spell check, filling the height its parent gives it. Tab still
 * moves focus, so the field is never a keyboard trap.
 */
function Textarea({
  className,
  variant = 'default',
  ...rest
}: React.ComponentProps<'textarea'> & { variant?: keyof typeof variants }): React.ReactElement {
  const props = useFieldControl(rest)
  const code = variant === 'code'
  return (
    <textarea
      data-slot="textarea"
      data-variant={variant}
      spellCheck={code ? false : undefined}
      autoCapitalize={code ? 'off' : undefined}
      autoCorrect={code ? 'off' : undefined}
      wrap={code ? 'off' : undefined}
      className={cn(
        inputSurface,
        'focus-ring w-full min-w-0 cursor-text resize-none outline-none placeholder:text-fg-muted selection:bg-selection aria-invalid:focus-visible:outline-danger-solid disabled:cursor-not-allowed disabled:opacity-50 [&[readonly]]:border-border-default [&[readonly]]:bg-transparent',
        variants[variant],
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
