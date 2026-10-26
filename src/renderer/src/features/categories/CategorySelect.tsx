import type { Category } from '@shared/categories'
import { ColorChip } from '@renderer/components/ColorChip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { errorProps } from '@renderer/lib/forms'
import { categoryIconComponents } from './appearance'

interface CategorySelectProps {
  id: string
  /** The category id as a string, or '' for none. */
  value: string
  categories: Category[]
  error?: string
  onChange: (value: string) => void
}

export function CategorySelect({
  id,
  value,
  categories,
  error,
  onChange
}: CategorySelectProps): React.JSX.Element {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} {...errorProps(id, error)}>
        <SelectValue placeholder="Choose a category" />
      </SelectTrigger>
      <SelectContent>
        {categories.map((c) => (
          <SelectItem key={c.id} value={String(c.id)}>
            <span className="flex items-center gap-2">
              <ColorChip color={c.color} icon={categoryIconComponents[c.icon]} size="sm" />
              {c.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
