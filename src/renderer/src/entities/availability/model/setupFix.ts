// Setup notices as hooks: the fix each one offers, and the list the title-bar chip and its menu item show.
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Bot, Box, Download, FolderOpen, GitBranch, Monitor } from 'lucide-react'
import type { SetupNotice } from '@/entities/availability/ui/SetupNotices'
import { studio } from '@/shared/api/studio'
import { useAvailability } from './availability'
import { ISSUES, focusIssue, missingIssues, type Issue } from './setupIssues'

const ICONS: Record<Issue, typeof Box> = {
  workspace: FolderOpen,
  engine: Box,
  pack: Box,
  browser: Monitor,
  export: Download,
  ai: Bot,
  git: GitBranch,
  identity: GitBranch
}

/** Runs the repair a notice offers: an install straight away, everything else opens its Settings section. */
export function useFixIssue(): (id: Issue) => void {
  const navigate = useNavigate()
  return (id) => {
    const { install, section, name } = ISSUES[id]
    void navigate({ to: '/settings', search: { section } }).then(() => focusIssue(id))
    if (install)
      toast.promise(studio.runtime.install(install), {
        loading: `Installing ${name.toLowerCase()}…`,
        success: `${name} installed`,
        error: (e) => `${name} wasn’t installed. ${e}`
      })
  }
}

/** The missing issues as notices for the kit chip and menu item; [] until the checks load. */
export function useSetupNotices(): SetupNotice[] {
  const missing = missingIssues(useAvailability().data)
  const fix = useFixIssue()
  return missing.map((id) => ({
    id,
    label: ISSUES[id].name,
    detail: ISSUES[id].why,
    icon: ICONS[id],
    action: ISSUES[id].action,
    onFix: () => fix(id)
  }))
}
