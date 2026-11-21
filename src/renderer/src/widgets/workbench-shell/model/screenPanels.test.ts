import { describe, expect, it, vi } from 'vitest'
import { Box } from 'lucide-react'
import type { WorkbenchPanel } from '@/widgets/workbench-shell/ui/Dock'
import {
  clearScreenPanels,
  getScreenPanels,
  setScreenPanels,
  subscribeScreenPanels
} from './screenPanels'

const panel: WorkbenchPanel = {
  id: 'editor',
  side: 'right',
  title: 'Inspector',
  icon: Box,
  content: null
}

describe('screenPanels', () => {
  it('sets, clears and notifies subscribers until they unsubscribe', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeScreenPanels(listener)
    setScreenPanels([panel])
    expect(getScreenPanels()).toEqual([panel])
    clearScreenPanels()
    expect(getScreenPanels()).toEqual([])
    expect(listener).toHaveBeenCalledTimes(2)
    unsubscribe()
    setScreenPanels([panel])
    expect(listener).toHaveBeenCalledTimes(2)
    clearScreenPanels()
  })
})
