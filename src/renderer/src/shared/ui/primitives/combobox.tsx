import * as React from 'react'
import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandLoading
} from '@/shared/ui/primitives/command'
import { useFieldControl } from '@/shared/ui/primitives/field'
import { inputSurface } from '@/shared/ui/primitives/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/primitives/popover'

type ComboboxOption = {
  value: string
  label: string
  /** A second, muted line in the list. */
  description?: string
  /** Extra words that match the search, e.g. a block id. */
  keywords?: string[]
  disabled?: boolean
}

type ComboboxProps = {
  options: ComboboxOption[]
  value: string | null
  onValueChange: (value: string | null) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: React.ReactNode
  /**
   * Async mode: called on every keystroke; filter or fetch `options` yourself (the list then
   * shows them as given). Pair with `loading` while a request runs.
   */
  onSearchChange?: (search: string) => void
  loading?: boolean
  disabled?: boolean
  /** Lets a second click on the selected option clear it. */
  clearable?: boolean
  className?: string
  id?: string
  'aria-label'?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
}

/** A searchable select: a trigger that opens a filtered list (cmdk in a popover). */
function Combobox({
  options,
  value,
  onValueChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'No matches',
  onSearchChange,
  loading = false,
  disabled,
  clearable = false,
  className,
  ...rest
}: ComboboxProps): React.ReactElement {
  const props = useFieldControl(rest)
  const [open, setOpen] = React.useState(false)
  const selected = options.find((o) => o.value === value)
  const listId = React.useId()
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          disabled={disabled}
          data-slot="combobox-trigger"
          data-placeholder={!selected || undefined}
          className={cn(
            inputSurface,
            'focus-ring flex h-(--density-control) w-full min-w-0 cursor-pointer items-center justify-between gap-2 px-2 text-start can-hover:bg-surface-hover aria-invalid:focus-visible:outline-danger-solid disabled:cursor-not-allowed disabled:opacity-50 data-placeholder:text-fg-muted',
            className
          )}
          {...props}
        >
          <span className="truncate">{selected?.label ?? placeholder}</span>
          <ChevronsUpDownIcon aria-hidden className="size-4 shrink-0 text-fg-muted" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) min-w-56 p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command shouldFilter={!onSearchChange} loop>
          <CommandInput
            autoFocus
            placeholder={searchPlaceholder}
            onValueChange={onSearchChange}
            loading={loading}
          />
          <CommandList id={listId}>
            {loading && options.length === 0 ? (
              <CommandLoading />
            ) : (
              <CommandEmpty>{emptyText}</CommandEmpty>
            )}
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={o.value}
                  keywords={[o.label, ...(o.keywords ?? [])]}
                  disabled={o.disabled}
                  onSelect={() => {
                    onValueChange(clearable && o.value === value ? null : o.value)
                    setOpen(false)
                  }}
                >
                  <CheckIcon
                    aria-hidden
                    className={cn(
                      'text-accent-text!',
                      o.value === value ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className="flex min-w-0 flex-col py-1">
                    <span className="truncate">{o.label}</span>
                    {o.description && (
                      <span className="truncate text-sm text-fg-muted">{o.description}</span>
                    )}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export { Combobox, type ComboboxOption, type ComboboxProps }
