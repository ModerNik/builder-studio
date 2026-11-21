import * as React from 'react'
import { CheckIcon, ChevronRightIcon, CircleIcon } from 'lucide-react'
import { Menubar as MenubarPrimitive } from 'radix-ui'
import { cn } from '@/shared/lib/utils'
import {
  menuChoiceItem,
  menuContent,
  menuIndicator,
  menuItem,
  menuLabel,
  menuSeparator,
  menuShortcut
} from '@/shared/ui/primitives/menu-styles'

/** A desktop-style menu bar: arrow keys move between menus. Give it an aria-label. */
function Menubar({
  className,
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.Root>): React.ReactElement {
  return (
    <MenubarPrimitive.Root
      data-slot="menubar"
      className={cn('flex h-(--density-control) items-center gap-0.5', className)}
      {...props}
    />
  )
}

function MenubarMenu(props: React.ComponentProps<typeof MenubarPrimitive.Menu>): React.ReactElement {
  return <MenubarPrimitive.Menu data-slot="menubar-menu" {...props} />
}

function MenubarTrigger({
  className,
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.Trigger>): React.ReactElement {
  return (
    <MenubarPrimitive.Trigger
      data-slot="menubar-trigger"
      className={cn(
        'flex h-(--density-control-sm) cursor-pointer items-center rounded-sm px-2 text-(length:--density-text) font-medium text-fg-secondary outline-none select-none data-highlighted:bg-surface-hover data-highlighted:text-fg data-[state=open]:bg-surface-hover data-[state=open]:text-fg focus-visible:outline-(length:--focus-width) focus-visible:outline-focus',
        className
      )}
      {...props}
    />
  )
}

function MenubarGroup(props: React.ComponentProps<typeof MenubarPrimitive.Group>): React.ReactElement {
  return <MenubarPrimitive.Group data-slot="menubar-group" {...props} />
}

function MenubarPortal(
  props: React.ComponentProps<typeof MenubarPrimitive.Portal>
): React.ReactElement {
  return <MenubarPrimitive.Portal data-slot="menubar-portal" {...props} />
}

function MenubarSub(props: React.ComponentProps<typeof MenubarPrimitive.Sub>): React.ReactElement {
  return <MenubarPrimitive.Sub data-slot="menubar-sub" {...props} />
}

function MenubarRadioGroup(
  props: React.ComponentProps<typeof MenubarPrimitive.RadioGroup>
): React.ReactElement {
  return <MenubarPrimitive.RadioGroup data-slot="menubar-radio-group" {...props} />
}

function MenubarContent({
  className,
  align = 'start',
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.Content>): React.ReactElement {
  return (
    <MenubarPrimitive.Portal>
      <MenubarPrimitive.Content
        data-slot="menubar-content"
        align={align}
        sideOffset={sideOffset}
        collisionPadding={8}
        className={cn(
          menuContent,
          'max-h-(--radix-menubar-content-available-height) origin-(--radix-menubar-content-transform-origin)',
          className
        )}
        {...props}
      />
    </MenubarPrimitive.Portal>
  )
}

function MenubarItem({
  className,
  inset,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.Item> & {
  inset?: boolean
  /** destructive: danger text, for Delete and Discard. */
  variant?: 'default' | 'destructive'
}): React.ReactElement {
  return (
    <MenubarPrimitive.Item
      data-slot="menubar-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(menuItem, className)}
      {...props}
    />
  )
}

function MenubarCheckboxItem({
  className,
  children,
  checked,
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.CheckboxItem>): React.ReactElement {
  return (
    <MenubarPrimitive.CheckboxItem
      data-slot="menubar-checkbox-item"
      className={cn(menuChoiceItem, className)}
      checked={checked}
      {...props}
    >
      <span className={menuIndicator}>
        <MenubarPrimitive.ItemIndicator>
          <CheckIcon className="text-accent-text!" />
        </MenubarPrimitive.ItemIndicator>
      </span>
      {children}
    </MenubarPrimitive.CheckboxItem>
  )
}

function MenubarRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.RadioItem>): React.ReactElement {
  return (
    <MenubarPrimitive.RadioItem
      data-slot="menubar-radio-item"
      className={cn(menuChoiceItem, className)}
      {...props}
    >
      <span className={menuIndicator}>
        <MenubarPrimitive.ItemIndicator>
          <CircleIcon className="size-2 fill-current text-accent-text!" />
        </MenubarPrimitive.ItemIndicator>
      </span>
      {children}
    </MenubarPrimitive.RadioItem>
  )
}

function MenubarLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.Label> & { inset?: boolean }): React.ReactElement {
  return (
    <MenubarPrimitive.Label
      data-slot="menubar-label"
      data-inset={inset}
      className={cn(menuLabel, className)}
      {...props}
    />
  )
}

function MenubarSeparator({
  className,
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.Separator>): React.ReactElement {
  return (
    <MenubarPrimitive.Separator
      data-slot="menubar-separator"
      className={cn(menuSeparator, className)}
      {...props}
    />
  )
}

/** The shortcut at the end of a row, e.g. "Ctrl+D". Decorative: the app binds keys elsewhere. */
function MenubarShortcut({ className, ...props }: React.ComponentProps<'span'>): React.ReactElement {
  return <span data-slot="menubar-shortcut" className={cn(menuShortcut, className)} {...props} />
}

function MenubarSubTrigger({
  className,
  inset,
  children,
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.SubTrigger> & {
  inset?: boolean
}): React.ReactElement {
  return (
    <MenubarPrimitive.SubTrigger
      data-slot="menubar-sub-trigger"
      data-inset={inset}
      className={cn(menuItem, 'data-[state=open]:bg-surface-hover', className)}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ms-auto rtl:rotate-180" />
    </MenubarPrimitive.SubTrigger>
  )
}

function MenubarSubContent({
  className,
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.SubContent>): React.ReactElement {
  return (
    <MenubarPrimitive.Portal>
      <MenubarPrimitive.SubContent
        data-slot="menubar-sub-content"
        collisionPadding={8}
        className={cn(
          menuContent,
          'origin-(--radix-menubar-content-transform-origin) shadow-lg',
          className
        )}
        {...props}
      />
    </MenubarPrimitive.Portal>
  )
}

export {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarLabel,
  MenubarMenu,
  MenubarPortal,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger
}
