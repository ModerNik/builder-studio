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
        One tab stop; arrow keys, Home and End move between screens. Screens that do not fit move
        into More, and the current screen always stays visible. On phones the strip becomes one
        menu. A badge for something waiting on the user (Review asked for, Variants lanes asking)
        takes badgeTone attention: amber, and the More dot turns amber when such a screen is in it.
      </p>
      <Specimen label="Tabs with overflow" resizable className="w-[45rem]">
        <ScreenTabs screens={SCREENS} value={screen} onChange={setScreen} label="Screens" />
      </Specimen>
      <Specimen label="Menu (phones)" className="w-[24.375rem] max-w-full">
        <ScreenTabs
          screens={SCREENS}
          value={screen}
          onChange={setScreen}
          mode="menu"
          label="Screens"
        />
      </Specimen>
    </div>
  )
}
