import type { ReactElement } from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { useCopy } from './copy'
import { IconAction } from './Tip'

/** Copy icon button; turns into a check and announces "Copied" for a moment. */
export function CopyButton({
  text,
  label = 'Copy',
  size,
  className
}: {
  text: string
  label?: string
  size?: 'sm' | 'xs'
  className?: string
}): ReactElement {
  const { copied, copy } = useCopy()
  return (
    <>
      <IconAction
        label={label}
        tip={copied ? 'Copied' : label}
        icon={copied ? Check : Copy}
        size={size}
        className={cn(copied && 'text-success-text hover:text-success-text', className)}
        onClick={() => copy(text)}
      />
      <span className="sr-only" aria-live="polite">
        {copied ? 'Copied' : ''}
      </span>
    </>
  )
}
