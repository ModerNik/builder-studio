import * as React from 'react'
import { cn } from '@/shared/lib/utils'
import { Input } from '@/shared/ui/primitives/input'
import { normaliseHex } from './colour'

/**
 * A colour as a swatch button plus a hex Input (Labs › Nearest). The swatch is the native colour input,
 * so it opens the system colour picker and works from the keyboard. Typed text is kept as typed until it
 * is a hex colour (#rgb or #rrggbb); on blur a bad value is marked invalid. `value` is "#rrggbb".
 */
function ColourField({
  value,
  onChange,
  label = 'Color',
  disabled,
  className,
  ...rest
}: Omit<React.ComponentProps<'input'>, 'value' | 'onChange' | 'type'> & {
  value: string
  onChange: (hex: string) => void
  /** Names both the swatch ("Pick colour") and the text field. */
  label?: string
}): React.ReactElement {
  const [text, setText] = React.useState(value)
  const [bad, setBad] = React.useState(false)
  // a new value from outside (the picker, a reset) replaces what was typed
  const [seen, setSeen] = React.useState(value)
  if (value !== seen) {
    setSeen(value)
    setText(value)
    setBad(false)
  }
  return (
    <Input
      {...rest}
      aria-label={rest['aria-label'] ?? `${label}, hex`}
      aria-invalid={bad || rest['aria-invalid'] || undefined}
      disabled={disabled}
      value={text}
      spellCheck={false}
      autoComplete="off"
      placeholder="#rrggbb"
      className={cn('w-40 font-mono', className)}
      onChange={(e) => {
        setText(e.target.value)
        const hex = normaliseHex(e.target.value)
        if (hex) {
          setBad(false)
          onChange(hex)
        }
      }}
      onBlur={() => setBad(text.trim() !== '' && !normaliseHex(text))}
      leading={
        <input
          type="color"
          aria-label={`Pick ${label.toLowerCase()}`}
          disabled={disabled}
          value={normaliseHex(value) ?? '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="focus-ring -ms-1 size-(--density-control-xs) shrink-0 cursor-pointer rounded-xs border border-fg/20 bg-transparent p-0 disabled:cursor-not-allowed [&::-webkit-color-swatch]:rounded-xs [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
        />
      }
    />
  )
}

export { ColourField }
