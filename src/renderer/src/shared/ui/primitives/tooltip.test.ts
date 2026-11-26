import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DropdownMenu } from 'radix-ui'
import { describe, expect, it } from 'vitest'
import { Tip } from '@/shared/ui/common/Tip'
import { Tabs, TabsList, TabsTrigger } from './tabs'
import { Toggle } from './toggle'
import { SegmentedControl, SegmentedControlItem } from './toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip'

const withTip = (label: string, child: React.ReactElement): React.ReactElement =>
  React.createElement(
    Tip as React.ComponentType<{ label: string; children?: React.ReactElement }>,
    { label },
    child
  )

describe('TooltipTrigger', () => {
  it('preserves SegmentedControlItem data-state when wrapped in Tip', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        SegmentedControl,
        { value: 'compare', 'aria-label': 'Build view' },
        withTip(
          '3D',
          React.createElement(SegmentedControlItem, { value: '3d', 'aria-label': '3D' })
        ),
        withTip(
          'Compare',
          React.createElement(SegmentedControlItem, {
            value: 'compare',
            'aria-label': 'Compare'
          })
        )
      )
    )

    const buttons = html.match(/<button\b[^>]*>/g) ?? []
    expect(buttons).toHaveLength(2)
    expect(buttons[0]).toContain('aria-label="3D"')
    expect(buttons[0]).toContain('aria-checked="false"')
    expect(buttons[0]).toContain('data-state="off"')
    expect(buttons[0]).toContain('data-slot="segmented-control-item"')
    expect(buttons[1]).toContain('aria-label="Compare"')
    expect(buttons[1]).toContain('aria-checked="true"')
    expect(buttons[1]).toContain('data-state="on"')
    expect(buttons[1]).toContain('data-slot="segmented-control-item"')
    expect(html).not.toContain('data-state="closed"')
  })

  it('preserves Toggle data-state when wrapped in Tip', () => {
    const html = renderToStaticMarkup(
      withTip(
        'Perspective',
        React.createElement(Toggle, { pressed: true, 'aria-label': 'Perspective' })
      )
    )

    expect(html).toContain('data-state="on"')
    expect(html).toContain('aria-pressed="true"')
    expect(html).not.toContain('data-state="closed"')
  })

  it('preserves TabsTrigger data-state when wrapped in Tip', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        Tabs,
        { value: 'parts' },
        React.createElement(
          TabsList,
          null,
          withTip('Parts', React.createElement(TabsTrigger, { value: 'parts' }, 'Parts')),
          withTip('Checks', React.createElement(TabsTrigger, { value: 'checks' }, 'Checks'))
        )
      )
    )

    expect(html).toContain('data-state="active"')
    expect(html).toContain('data-state="inactive"')
    expect(html).not.toContain('data-state="closed"')
  })

  it('preserves an outer data-state passed to TooltipTrigger asChild', () => {
    const triggerProps = { asChild: true, 'data-state': 'open' } as React.ComponentProps<
      typeof TooltipTrigger
    >
    const html = renderToStaticMarkup(
      React.createElement(
        Tooltip,
        null,
        React.createElement(
          TooltipTrigger,
          triggerProps,
          React.createElement('button', { type: 'button' }, 'Menu')
        ),
        React.createElement(TooltipContent, null, 'More actions')
      )
    )

    expect(html).toContain('data-state="open"')
  })

  it('preserves DropdownMenu.Trigger menu attributes when wrapped inside Tip', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        DropdownMenu.Root,
        null,
        withTip(
          'More screens',
          React.createElement(
            DropdownMenu.Trigger,
            { asChild: true },
            React.createElement('button', { type: 'button', 'aria-label': 'More screens' }, 'More')
          )
        )
      )
    )

    expect(html).toContain('aria-haspopup="menu"')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('aria-label="More screens"')
  })

  it('keeps default data-slot and data-state when not using asChild', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        Tooltip,
        null,
        React.createElement(TooltipTrigger, null, 'Info'),
        React.createElement(TooltipContent, null, 'Details')
      )
    )

    expect(html).toContain('data-slot="tooltip-trigger"')
    expect(html).toContain('data-state="closed"')
  })
})
