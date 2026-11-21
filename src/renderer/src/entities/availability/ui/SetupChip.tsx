// What is still missing, in three places: the title-bar chip, one floating toast for issues the user
// hasn't dismissed, and the ⋯ menu item on tablet and phone. A fix installs straight away or opens the
// Settings section and focuses the control that fixes it.
import { useEffect, type ReactElement } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { TriangleAlert, X } from 'lucide-react'
import { Button } from '@/shared/ui/primitives/button'
import { IconButton } from '@/shared/ui/primitives/icon-button'
import {
  SetupNoticesChip,
  SetupNoticesMenuItem,
  type SetupNotice
} from '@/entities/availability/ui/SetupNotices'
import { useAvailability } from '../model/availability'
import {
  ISSUES,
  keepDismissed,
  missingIssues,
  toastIssues,
  useDismissed,
  type Issue
} from '../model/setupIssues'
import { useFixIssue } from '../model/setupFix'

/** The title-bar chip, hidden when everything is set up; it also raises the setup toast. */
export function SetupChip({ notices }: { notices: SetupNotice[] }): ReactElement | null {
  const availability = useAvailability().data
  useSetupToast(availability ? missingIssues(availability) : null)
  return <SetupNoticesChip notices={notices} />
}

/** The same count in the title bar's ⋯ menu; opens Settings › Advanced, which lists every requirement. */
export function SetupMenuItem({ notices }: { notices: SetupNotice[] }): ReactElement | null {
  const navigate = useNavigate()
  return (
    <SetupNoticesMenuItem
      notices={notices}
      onSelect={() => void navigate({ to: '/settings', search: { section: 'advanced' } })}
    />
  )
}

const countText = (n: number): string => `${n} to set up`

/** One floating toast when issues appear that the user hasn't dismissed yet; `missing` is null until checks load. */
function useSetupToast(missing: Issue[] | null): void {
  const dismissed = useDismissed((s) => s.ids)
  const fix = useFixIssue()
  const key = missing?.join() ?? null
  useEffect(() => {
    // pruning against a not-yet-loaded list would forget every dismissal on each app start
    if (!missing) return
    const kept = keepDismissed(dismissed, missing)
    if (kept.length !== dismissed.length) useDismissed.setState({ ids: kept })
    const fresh = toastIssues(missing, kept)
    if (!fresh.length) {
      toast.dismiss('setup-notice')
      return
    }
    const dismiss = (): void => {
      useDismissed.setState((s) => ({ ids: [...new Set([...s.ids, ...fresh])] }))
      toast.dismiss('setup-notice')
    }
    toast.custom(
      () => (
        <SetupToast
          issue={fresh[0]}
          more={fresh.length - 1}
          total={missing.length}
          onFix={() => {
            dismiss()
            fix(fresh[0])
          }}
          onDismiss={dismiss}
        />
      ),
      { id: 'setup-notice', duration: Infinity, onDismiss: dismiss }
    )
    // keyed on the issue list: a re-render with the same issues keeps the toast as it is
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, dismissed.join()])
}

function SetupToast({
  issue,
  more,
  total,
  onFix,
  onDismiss
}: {
  issue: Issue
  more: number
  total: number
  onFix: () => void
  onDismiss: () => void
}): ReactElement {
  const { effect, why, action, install } = ISSUES[issue]
  return (
    <div
      role="status"
      className="flex w-95 max-w-[calc(100vw-2rem)] items-start gap-3 rounded-lg border border-border-default bg-surface-overlay py-3.5 ps-4 pe-2 text-fg shadow-lg max-sm:items-center max-sm:gap-2 max-sm:py-1.5 max-sm:ps-3"
    >
      <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning-text max-sm:mt-0" />
      {/* on a phone the toast is one line, title and fix, so it covers little; the chip menu has the rest */}
      <span className="flex min-w-0 flex-1 flex-col gap-2.5 max-sm:flex-row max-sm:items-center max-sm:gap-2">
        <span className="flex min-w-0 flex-col gap-0.5 max-sm:flex-1">
          <span className="font-semibold max-sm:truncate max-sm:text-sm">{effect}</span>
          <span className="text-sm text-fg-secondary max-sm:hidden">
            {why}
            {more > 0 &&
              ` ${more} more ${more === 1 ? 'thing needs' : 'things need'} setting up.`}{' '}
            It stays listed under “{countText(total)}” if you dismiss this.
          </span>
        </span>
        <span className="flex gap-2">
          <Button size="sm" variant={install ? 'primary' : 'outline'} onClick={onFix}>
            {action}
          </Button>
          <Button size="sm" variant="ghost" onClick={onDismiss} className="max-sm:hidden">
            Not now
          </Button>
        </span>
      </span>
      <IconButton
        label="Dismiss"
        size="icon-sm"
        onClick={onDismiss}
        className="-mt-1.5 max-sm:mt-0"
      >
        <X aria-hidden />
      </IconButton>
    </div>
  )
}
