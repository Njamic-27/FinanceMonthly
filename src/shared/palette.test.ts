import { describe, expect, it } from 'vitest'
import { isPaletteColor, nextPaletteColor } from './palette'

describe('nextPaletteColor', () => {
  it('hands out colours in validated order, skipping used ones', () => {
    expect(nextPaletteColor([])).toBe('blue')
    expect(nextPaletteColor(['blue'])).toBe('orange')
    expect(nextPaletteColor(['orange', 'slate'])).toBe('blue')
  })

  it('repeats in order once every colour is taken, never picking the neutral', () => {
    const all = ['blue', 'orange', 'aqua', 'plum', 'olive', 'pink', 'brown', 'sky'] as const
    expect(nextPaletteColor(all)).toBe('blue')
    expect(nextPaletteColor([...all, 'blue'])).toBe('orange')
  })
})

describe('isPaletteColor', () => {
  it('accepts palette names only', () => {
    expect(isPaletteColor('sky')).toBe(true)
    expect(isPaletteColor('green')).toBe(false)
    expect(isPaletteColor(null)).toBe(false)
  })
})
