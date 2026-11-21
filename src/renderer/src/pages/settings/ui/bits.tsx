// Settings fields that save as you type, and the error notice under a row that failed.
import { useEffect, useRef, useState, type ReactElement } from 'react'
import { Button } from '@/shared/ui/primitives/button'
import { Input } from '@/shared/ui/primitives/input'
import { InlineNotice } from '@/shared/ui/feedback/Alert'
import { ErrorDetails } from '@/shared/ui/feedback/ErrorState'
import { errorMessage } from '@/shared/ui/feedback/errors'
import { cn } from '@/shared/lib/utils'
import { useSaveSettings, type PathKey } from '@/entities/settings/model/save'
import { pickPath } from '../model/pick'

export const ErrorNotice = ({ error }: { error: unknown }): ReactElement | null =>
  error ? (
    <div className="min-w-0">
      <InlineNotice tone="danger" className="text-sm">
        {errorMessage(error)}
      </InlineNotice>
      <ErrorDetails error={error} />
    </div>
  ) : null

/**
 * A setting typed into a field; put it in a kit Field for its label, hint and error. Empty saves empty, so
 * the app keeps using what it detects (the placeholder). Typing saves after a pause; `onBlurOnly` waits until
 * the field is left, for settings that reload the window or move folders, so half-typed paths are never used.
 */
export function SettingInput({
  setting,
  value,
  placeholder,
  label,
  browse,
  onBlurOnly,
  mono = true
}: {
  setting: PathKey
  value: string
  placeholder?: string
  /** Names Browse… for screen readers: "Browse for <label>". */
  label?: string
  browse?: 'file' | 'folder'
  onBlurOnly?: boolean
  mono?: boolean
}): ReactElement {
  const save = useSaveSettings()
  const [draft, setDraft] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const commit = (next: string): void => {
    clearTimeout(timer.current)
    if (next.trim() === value) return setDraft(null)
    // typing on while it saves keeps the newer text
    save.mutate(
      { [setting]: next.trim() },
      { onSuccess: () => setDraft((d) => (d === next ? null : d)) }
    )
  }
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="flex min-w-0 gap-2">
        <Input
          className={cn('min-w-0 flex-1', mono && 'font-mono text-sm')}
          value={draft ?? value}
          placeholder={placeholder}
          spellCheck={false}
          onChange={(e) => {
            const next = e.target.value
            setDraft(next)
            clearTimeout(timer.current)
            if (!onBlurOnly) timer.current = setTimeout(() => commit(next), 800)
          }}
          onBlur={() => draft !== null && commit(draft)}
          onKeyDown={(e) => e.key === 'Enter' && draft !== null && commit(draft)}
        />
        {browse && (
          <Button
            variant="outline"
            aria-label={label ? `Browse for ${label}` : undefined}
            onClick={() =>
              void pickPath(browse, value || placeholder || '').then((path) => path && commit(path))
            }
          >
            Browse…
          </Button>
        )}
      </span>
      <ErrorNotice error={save.error} />
    </div>
  )
}
