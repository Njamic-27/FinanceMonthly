import type { CategoryIcon } from '@shared/categories'
import type { PaletteColor } from '@shared/palette'
import { ColorChip } from '@renderer/components/ColorChip'
import { categoryIconComponents } from './appearance'

interface CategoryChipProps {
  color: PaletteColor
  icon: CategoryIcon
  size?: 'sm' | 'md'
  className?: string
}

export function CategoryChip({ icon, ...props }: CategoryChipProps): React.JSX.Element {
  return <ColorChip icon={categoryIconComponents[icon]} {...props} />
}
