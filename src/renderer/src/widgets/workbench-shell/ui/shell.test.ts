import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { Activity, MessageCircle } from 'lucide-react'
import { WorkbenchContext } from '../model/context'
import { PanelToggle } from './PanelToggle'
import { TitleBar } from './TitleBar'
import { WindowControls } from './WindowControls'

const wrapWorkbench = (
  tier: 'wide' | 'desktop' | 'tablet' | 'phone',
  openPanels: string[],
  node: React.ReactElement
): React.ReactElement =>
  React.createElement(
    WorkbenchContext.Provider,
    { value: { tier, dock: vi.fn(), openPanels } },
    node
  )

describe('PanelToggle', () => {
  it('renders a labelled pill for right-side panels when showLabel is true', () => {
    const html = renderToStaticMarkup(
      wrapWorkbench(
        'wide',
        ['assistant'],
        React.createElement(PanelToggle, {
          showLabel: true,
          panel: {
            id: 'assistant',
            side: 'right',
            title: 'Chat',
            icon: MessageCircle,
            keys: 'Ctrl+J',
            badge: 2,
            badgeLabel: '2 asks need you',
            badgeTone: 'attention',
            content: null
          }
        })
      )
    )

    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('>Chat<')
    expect(html).toContain('2 asks need you')
  })

  it('keeps bottom-side panels compact icon-only even when showLabel is true', () => {
    const html = renderToStaticMarkup(
      wrapWorkbench(
        'wide',
        [],
        React.createElement(PanelToggle, {
          showLabel: true,
          panel: {
            id: 'activity',
            side: 'bottom',
            title: 'Activity',
            icon: Activity,
            keys: 'Ctrl+`',
            content: null
          }
        })
      )
    )

    expect(html).toContain('aria-label="Activity"')
    expect(html).not.toContain('>Activity<')
  })
})

describe('TitleBar', () => {
  it('allows the build switcher button to shrink for long display names', () => {
    const html = renderToStaticMarkup(
      wrapWorkbench(
        'desktop',
        [],
        React.createElement(TitleBar, {
          crumbs: [
            {
              label: 'A Very Long Build Display Name That Should Truncate Cleanly',
              menu: {
                label: 'Switch build',
                items: [{ id: 'a', label: 'A' }],
                value: 'a',
                onSelect: () => {}
              }
            }
          ],
          onHome: () => {},
          onSearch: () => {}
        })
      )
    )

    const switcherMatch = html.match(/<button\b[^>]*aria-label="Switch build:[^"]*"[^>]*>/)
    expect(switcherMatch?.[0]).toBeTruthy()
    const classes = (switcherMatch?.[0].match(/class="([^"]*)"/)?.[1] ?? '').split(/\s+/)
    expect(classes).toContain('shrink')
    expect(classes).not.toContain('shrink-0')
  })

  it('includes the Builder Studio title inside the home button when shown', () => {
    const html = renderToStaticMarkup(
      wrapWorkbench(
        'desktop',
        [],
        React.createElement(TitleBar, {
          crumbs: [{ label: 'Settings' }],
          onHome: () => {}
        })
      )
    )

    const homeButtonMatch = html.match(
      /<button\b[^>]*aria-label="Builder Studio: all builds"[^>]*>[\s\S]*?<\/button>/
    )
    expect(homeButtonMatch?.[0]).toBeTruthy()
    expect(homeButtonMatch?.[0]).toContain('Builder Studio')
  })
})

describe('WindowControls', () => {
  it('renders Minimize, Maximize and Close buttons when restored', () => {
    const html = renderToStaticMarkup(React.createElement(WindowControls, { maximized: false }))

    expect(html).toContain('aria-label="Minimize"')
    expect(html).toContain('aria-label="Maximize"')
    expect(html).toContain('aria-label="Close"')
    expect(html).not.toContain('aria-label="Restore"')
  })

  it('switches Maximize to Restore when maximized', () => {
    const html = renderToStaticMarkup(React.createElement(WindowControls, { maximized: true }))

    expect(html).toContain('aria-label="Restore"')
    expect(html).not.toContain('aria-label="Maximize"')
  })

  it('renders decorative preview controls without interactive buttons', () => {
    const html = renderToStaticMarkup(
      React.createElement(WindowControls, { maximized: false, decorative: true })
    )

    expect(html).toContain('aria-hidden="true"')
    expect(html).not.toContain('<button')
  })
})
