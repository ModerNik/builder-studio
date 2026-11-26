// Settings: seven sections in a rail (a drill-in list on phone), one section at a time; only the pane scrolls.
import type { ReactElement } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import {
  Bot,
  Cable,
  Gamepad2,
  ScanSearch,
  Settings2,
  SlidersHorizontal,
  Wrench
} from 'lucide-react'
import { PageHeader } from '@/shared/ui/layout/PageHeader'
import { SideNavLayout } from '@/shared/ui/layout/SideNavLayout'
import { ErrorState } from '@/shared/ui/feedback/ErrorState'
import { LoadingState } from '@/shared/ui/feedback/LoadingState'
import { useAvailability } from '@/entities/availability/model/availability'
import { useSettings } from '@/entities/settings/model/settings'
import {
  ISSUES,
  missingIssues,
  SECTIONS,
  type Section
} from '@/entities/availability/model/setupIssues'
import { General } from './General'
import { Minecraft } from './Minecraft'
import { Linter } from './Linter'
import { Ai } from './Ai'
import { Agents } from './Agents'
import { Tools } from './Tools'
import { Advanced } from './Advanced'
import { useSaveStatus } from '../model/saveStatus'

const SECTION: Record<Section, { label: string; icon: typeof Bot; lead: string }> = {
  general: {
    label: 'General',
    icon: Settings2,
    lead: 'How the app looks, where your builds are kept, and app updates.'
  },
  minecraft: {
    label: 'Minecraft',
    icon: Gamepad2,
    lead: 'Leave a field empty to use what Builder Studio finds, shown in gray.'
  },
  linter: {
    label: 'Linter',
    icon: ScanSearch,
    lead: 'Choose whether build checks run and which lint rules are active. Highlighting in 3D is toggled from the Checks tab.'
  },
  ai: {
    label: 'AI assistant',
    icon: Bot,
    lead: 'Choose who drafts and revises builds with you. Builds work without AI too.'
  },
  agents: {
    label: 'External agents',
    icon: Cable,
    lead: 'While Builder Studio runs, an agent on this PC can connect over MCP to open builds, show render sheets, see what you have open and ask you to review variants.'
  },
  tools: {
    label: 'Build tools',
    icon: Wrench,
    lead: 'Tools Builder Studio installs and manages in its own folder.'
  },
  advanced: {
    label: 'Advanced',
    icon: SlidersHorizontal,
    lead: 'Documentation, diagnostics and manual overrides. Most people never need the overrides.'
  }
}

function SaveStatus(): ReactElement {
  const { saving, last } = useSaveStatus()
  return (
    <span role="status" className={last === 'error' && !saving ? 'text-danger-text' : undefined}>
      {saving ? 'Saving…' : last === 'error' ? 'Couldn’t save' : 'All changes saved'}
    </span>
  )
}

export function SettingsPage(): ReactElement {
  const settings = useSettings()
  const { section: linked } = useSearch({ from: '/settings' })
  const section = linked ?? 'general'
  const navigate = useNavigate()
  const missing = missingIssues(useAvailability().data)
  if (settings.isError)
    return (
      <ErrorState
        title="Settings can’t be read"
        error={settings.error}
        onRetry={() => void settings.refetch()}
      />
    )
  if (!settings.data) return <LoadingState label="Loading settings…" />
  const items = SECTIONS.map((id) => {
    const needs = missing.filter((issue) => ISSUES[issue].section === id)
    return {
      id,
      label: SECTION[id].label,
      icon: SECTION[id].icon,
      notice: needs.length
        ? `Needs setup: ${needs.map((n) => ISSUES[n].name.toLowerCase()).join(', ')}`
        : undefined
    }
  })
  const data = settings.data
  return (
    <SideNavLayout
      label="Settings"
      narrow="drill"
      collapseBelow={40}
      // on phone the open section lives in the URL: a link to a section opens it, plain Settings shows the list
      drilled={!!linked}
      onBack={() => void navigate({ to: '/settings', search: {} })}
      items={items}
      value={section}
      onChange={(id) =>
        void navigate({ to: '/settings', search: { section: id as Section }, replace: !!linked })
      }
      className="h-full px-4 pt-4 sm:px-6 sm:pt-6 lg:px-10"
    >
      <div className="h-full overflow-auto pb-12">
        <div className="mx-auto flex max-w-settings flex-col gap-6">
          <PageHeader
            title={SECTION[section].label}
            description={SECTION[section].lead}
            actions={
              <span className="text-sm text-fg-secondary">
                <SaveStatus />
              </span>
            }
          />
          {section === 'general' && <General settings={data} />}
          {section === 'minecraft' && <Minecraft settings={data} />}
          {section === 'linter' && <Linter settings={data} />}
          {section === 'ai' && <Ai settings={data} />}
          {section === 'agents' && <Agents />}
          {section === 'tools' && <Tools />}
          {section === 'advanced' && <Advanced settings={data} />}
        </div>
      </div>
    </SideNavLayout>
  )
}
