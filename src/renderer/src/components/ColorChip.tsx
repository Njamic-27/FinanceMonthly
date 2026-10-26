import type { LucideIcon } from 'lucide-react'
import type { PaletteColor } from '@shared/palette'
import { swatchStyle } from '@renderer/lib/palette'
import { cn } from '@renderer/lib/utils'

interface ColorChipProps {
  color: PaletteColor
  icon: LucideIcon
  size?: 'sm' | 'md'
  className?: string
}

/** An icon on a tint of a palette colour. Decorative: a name always sits beside it. */
export function ColorChip({
  color,
  icon: Icon,
  size = 'md',
  className
}: ColorChipProps): React.JSX.Element {
  return (
    <span
      aria-hidden
      style={swatchStyle(color)}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-(color:--swatch)/15 text-(color:--swatch)',
        size === 'md' ? 'size-9 [&_svg]:size-[1.125rem]' : 'size-7 [&_svg]:size-3.5',
        className
      )}
    >
      <Icon />
    </span>
  )
}
