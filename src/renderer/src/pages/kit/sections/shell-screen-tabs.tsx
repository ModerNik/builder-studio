import { useState, type ReactElement } from 'react'
import { ScreenTabs } from '@/widgets/workbench-shell/ui/ScreenTabs'
import { SCREENS } from './shell-demo/data'
import { Specimen } from './shell-demo/Specimen'

export const meta = { group: 'Shell', title: 'Screen tabs' }

export default function ScreenTabsDemo(): ReactElement {
  const [screen, setScreen] = useState('review')
  return (
    <div>
      <p className="mb-4 max-w-prose text-fg-secondary">
        Workflow-grouped soft pills with icons and hairlines separating core, context, and export
        screens. One tab stop; arrow keys, Home and End move between screens. Screens that do not
        fit move into More, and the current screen always stays visible. On tablet and phone tiers
        the strip collapses to compact icon-only pills with tooltips and corner badges. A badge for
        something waiting on the user (Review asked for, Variants lanes asking) takes badgeTone
        attention: amber, and the More dot turns amber when such a screen is in it.
      </p>
      <Specimen
        label="Workflow-grouped pills with overflow (desktop / wide)"
        resizable
        className="w-[48rem]"
      >
        <div className="flex h-(--shell-tabbar) items-center bg-surface-panel px-4">
          <ScreenTabs screens={SCREENS} value={screen} onChange={setScreen} label="Screens" />
        </div>
      </Specimen>
      <Specimen
        label="Compact icon-only pills (tablet & phone)"
        resizable
        className="w-[24.375rem] max-w-full"
      >
        <div className="flex h-(--shell-tabbar) items-center bg-surface-panel px-3">
          <ScreenTabs
            screens={SCREENS}
            value={screen}
            onChange={setScreen}
            mode="icons"
            label="Screens"
          />
        </div>
      </Specimen>
      <Specimen label="Menu mode" className="w-[24.375rem] max-w-full">
        <div className="flex h-(--shell-tabbar) items-center bg-surface-panel px-3">
          <ScreenTabs
            screens={SCREENS}
            value={screen}
            onChange={setScreen}
            mode="menu"
            label="Screens"
          />
        </div>
      </Specimen>
    </div>
  )
}
