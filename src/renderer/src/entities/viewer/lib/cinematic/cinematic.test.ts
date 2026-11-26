import { describe, expect, it } from 'vitest'
import { emissiveInfo } from './emissive'
import { skyPalette } from './shaders'
import { defaultStudioSettings, RENDER_PRESETS, resolveExportSize } from './presets'
import { findCropRect } from './compose'

describe('cinematic render helpers', () => {
  it('classifies always-emissive and state-conditional light blocks', () => {
    expect(emissiveInfo('minecraft:lantern[hanging=true]')).not.toBeNull()
    expect(emissiveInfo('minecraft:soul_lantern')).not.toBeNull()
    expect(emissiveInfo('minecraft:glowstone')).not.toBeNull()
    expect(emissiveInfo('minecraft:redstone_lamp[lit=true]')).not.toBeNull()
    expect(emissiveInfo('minecraft:redstone_lamp[lit=false]')).toBeNull()
    expect(emissiveInfo('minecraft:red_candle[candles=3,lit=true]')).not.toBeNull()
    expect(emissiveInfo('minecraft:red_candle[candles=3,lit=false]')).toBeNull()
    expect(emissiveInfo('minecraft:cave_vines[berries=true]')).not.toBeNull()
    expect(emissiveInfo('minecraft:respawn_anchor[charges=2]')).not.toBeNull()
    expect(emissiveInfo('minecraft:respawn_anchor[charges=0]')).toBeNull()
    expect(emissiveInfo('minecraft:stone_bricks')).toBeNull()
  })

  it('transitions sky palette cleanly from midday through golden hour to night', () => {
    const noon = skyPalette(60)
    const sunset = skyPalette(12)
    const night = skyPalette(-10)
    expect(noon.stars).toBe(0)
    expect(night.stars).toBeGreaterThan(0.8)
    expect(sunset.horizon.r).toBeGreaterThan(sunset.horizon.b)
    expect(noon.zenith.b).toBeGreaterThan(noon.zenith.r)
  })

  it('resolves export pixel dimensions for fixed and free aspect ratios', () => {
    expect(resolveExportSize('1920x1080', '16:9')).toEqual({ width: 1920, height: 1080 })
    expect(resolveExportSize('1920x1080', '1:1')).toEqual({ width: 1920, height: 1920 })
    expect(resolveExportSize('1920x1080', '9:16')).toEqual({ width: 1080, height: 1920 })
    expect(resolveExportSize('3840x2160', '4:3')).toEqual({ width: 3840, height: 2880 })
    expect(resolveExportSize('1920x1080', 'free', 2)).toEqual({ width: 1920, height: 960 })
  })

  it('crops transparent and solid margins cleanly with padding', () => {
    const w = 10
    const h = 10
    const rgba = new Uint8ClampedArray(w * h * 4)
    // Put one opaque pixel at (5, 4)
    const i = (4 * w + 5) * 4
    rgba[i] = 255
    rgba[i + 1] = 128
    rgba[i + 2] = 64
    rgba[i + 3] = 255
    expect(findCropRect(rgba, w, h, true, 1)).toEqual({ x: 4, y: 3, width: 3, height: 3 })
    expect(findCropRect(rgba, w, h, false, 1)).toEqual({ x: 4, y: 3, width: 3, height: 3 })
  })

  it('provides coherent default studio settings backed by a preset', () => {
    const d = defaultStudioSettings()
    expect(RENDER_PRESETS.some((p) => p.id === d.preset)).toBe(true)
    expect(d.sheetViews.length).toBeGreaterThan(0)
  })
})
