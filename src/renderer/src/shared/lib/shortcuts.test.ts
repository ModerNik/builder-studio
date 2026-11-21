import { afterEach, describe, expect, it, vi } from 'vitest'
import { dispatch, formatKeys, matches, registerShortcut, type KeyLike } from './shortcuts'

const key = (k: string, mods: Partial<KeyLike> = {}): KeyLike => ({
  key: k,
  code: '',
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...mods
})

describe('matches', () => {
  it('matches Ctrl chords, with Cmd standing in for Ctrl', () => {
    expect(matches(key('i', { ctrlKey: true }), 'Ctrl+I')).toBe(true)
    expect(matches(key('i', { metaKey: true }), 'Ctrl+I')).toBe(true)
    expect(matches(key('i'), 'Ctrl+I')).toBe(false)
    expect(matches(key('I', { ctrlKey: true, shiftKey: true }), 'Ctrl+I')).toBe(false)
  })
  it('matches Ctrl ` by key code on layouts where the key prints something else', () => {
    expect(matches(key('ё', { ctrlKey: true, code: 'Backquote' }), 'Ctrl+`')).toBe(true)
  })
  it('lets symbols carry their own Shift', () => {
    expect(matches(key('?', { shiftKey: true }), '?')).toBe(true)
    expect(matches(key('['), '[')).toBe(true)
  })
  it('needs Shift to match exactly for named keys', () => {
    expect(matches(key('Tab', { ctrlKey: true, shiftKey: true }), 'Ctrl+Shift+Tab')).toBe(true)
    expect(matches(key('Tab', { ctrlKey: true }), 'Ctrl+Shift+Tab')).toBe(false)
  })
  it('formats keys for hints', () => {
    expect(formatKeys('Ctrl+Shift+Tab')).toEqual(['Ctrl', 'Shift', 'Tab'])
  })
})

describe('dispatch', () => {
  const offs: (() => void)[] = []
  afterEach(() => offs.splice(0).forEach((off) => off()))

  it('runs the newest registration first and stops there', () => {
    const older = vi.fn()
    const newer = vi.fn()
    offs.push(registerShortcut({ keys: 'Ctrl+J', label: 'a', group: 'g', run: older }))
    offs.push(registerShortcut({ keys: 'Ctrl+J', label: 'b', group: 'g', run: newer }))
    expect(dispatch(key('j', { ctrlKey: true }))).toBe(true)
    expect(newer).toHaveBeenCalledOnce()
    expect(older).not.toHaveBeenCalled()
  })
  it('falls back to the older one when the newer unregisters', () => {
    const older = vi.fn()
    offs.push(registerShortcut({ keys: '?', label: 'help', group: 'g', run: older }))
    const off = registerShortcut({ keys: '?', label: 'other', group: 'g', run: vi.fn() })
    off()
    dispatch(key('?', { shiftKey: true }))
    expect(older).toHaveBeenCalledOnce()
  })
  it('returns false when nothing matches', () => {
    expect(dispatch(key('x'))).toBe(false)
  })
  it('leaves a chord to a text field when the shortcut opts out of fields', () => {
    // a stand-in for an <input> in the node test environment
    class Field {
      matches = (): boolean => true
      closest = (): null => null
    }
    vi.stubGlobal('Element', Field)
    const undo = vi.fn()
    const open = vi.fn()
    offs.push(
      registerShortcut({ keys: 'Ctrl+Z', label: 'Undo', group: 'g', run: undo, inFields: false }),
      registerShortcut({ keys: 'Ctrl+K', label: 'Open', group: 'g', run: open })
    )
    expect(dispatch({ ...key('z', { ctrlKey: true }), target: new Field() as never })).toBe(false)
    expect(dispatch({ ...key('k', { ctrlKey: true }), target: new Field() as never })).toBe(true)
    expect(undo).not.toHaveBeenCalled()
    expect(open).toHaveBeenCalledOnce()
    vi.unstubAllGlobals()
  })
})
