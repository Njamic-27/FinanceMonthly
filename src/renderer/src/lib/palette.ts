import type { PaletteColor } from '@shared/palette'

export function colorLabel(color: PaletteColor): string {
  return color.charAt(0).toUpperCase() + color.slice(1)
}

/** Sets `--swatch` to a palette colour, for `text-(color:--swatch)` / `bg-(color:--swatch)/15`. */
export function swatchStyle(color: PaletteColor): React.CSSProperties {
  return { '--swatch': `var(--swatch-${color})` } as React.CSSProperties
}
