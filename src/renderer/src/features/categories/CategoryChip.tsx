import type { CategoryColor, CategoryIcon } from '@shared/categories'
import { cn } from '@renderer/lib/utils'
import { categoryColorStyle, categoryIconComponents } from './appearance'

interface CategoryChipProps {
  color: CategoryColor
  icon: CategoryIcon
  size?: 'sm' | 'md'
  className?: string
}

/** The category's icon on a tint of its colour. Decorative: the name always sits beside it. */
export function CategoryChip({
  color,
  icon,
  size = 'md',
  className
}: CategoryChipProps): React.JSX.Element {
  const Icon = categoryIconComponents[icon]
  return (
    <span
      aria-hidden
      style={categoryColorStyle(color)}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-(color:--cat)/15 text-(color:--cat)',
        size === 'md' ? 'size-9 [&_svg]:size-[1.125rem]' : 'size-7 [&_svg]:size-3.5',
        className
      )}
    >
      <Icon />
    </span>
  )
}
