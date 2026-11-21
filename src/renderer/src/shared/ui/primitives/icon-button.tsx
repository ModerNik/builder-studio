import * as React from 'react'
import { Button, type ButtonProps } from '@/shared/ui/primitives/button'
import { Shortcut } from '@/shared/ui/primitives/kbd'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/primitives/tooltip'

type IconButtonProps = Omit<ButtonProps, 'size' | 'aria-label' | 'title' | 'asChild'> & {
  /** Required: the accessible name and the tooltip text. */
  label: string
  /** Shown in the tooltip, e.g. "Ctrl+Z". */
  shortcut?: string
  size?: 'icon' | 'icon-xs' | 'icon-sm' | 'icon-lg'
  tooltipSide?: React.ComponentProps<typeof TooltipContent>['side']
}

/** An icon-only button. The label is its aria-label and its tooltip; a disabled one shows no tooltip. */
function IconButton({
  label,
  shortcut,
  size = 'icon',
  variant = 'ghost',
  tooltipSide,
  ...props
}: IconButtonProps): React.ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button aria-label={label} size={size} variant={variant} {...props} />
      </TooltipTrigger>
      <TooltipContent side={tooltipSide}>
        {label}
        {shortcut && <Shortcut keys={shortcut} />}
      </TooltipContent>
    </Tooltip>
  )
}

export { IconButton, type IconButtonProps }
