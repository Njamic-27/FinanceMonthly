/**
 * Colours people choose for categories and accounts, stored by name so each one has a light
 * and a dark step (main.css, `--swatch-*`). The first eight are in validated order: neighbours
 * stay distinguishable with colour-vision deficiencies, so hand them out in this order.
 * `slate` is the neutral for "Other". Green, red, amber and violet are left out — they mean
 * money kinds (DESIGN.md).
 */
export const paletteColors = [
  'blue',
  'orange',
  'aqua',
  'plum',
  'olive',
  'pink',
  'brown',
  'sky',
  'slate'
] as const
export type PaletteColor = (typeof paletteColors)[number]

export const neutralPaletteColor: PaletteColor = 'slate'

export function isPaletteColor(value: unknown): value is PaletteColor {
  return (paletteColors as readonly unknown[]).includes(value)
}

/** The first colour, in validated order, not in `used`; once all are taken they repeat. */
export function nextPaletteColor(used: readonly PaletteColor[]): PaletteColor {
  const hues = paletteColors.filter((c) => c !== neutralPaletteColor)
  const taken = new Set(used)
  return hues.find((c) => !taken.has(c)) ?? hues[used.length % hues.length]
}
