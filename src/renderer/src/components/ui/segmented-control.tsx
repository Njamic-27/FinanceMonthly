import type { LucideIcon } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

export interface SegmentedOption<V extends string> {
  value: V
  label: string
  icon?: LucideIcon
}

interface SegmentedControlProps<V extends string> {
  /** Groups the radio buttons; must be unique on the page. */
  name: string
  value: V | undefined
  options: SegmentedOption<V>[]
  onValueChange: (value: V) => void
  'aria-label'?: string
  'aria-labelledby'?: string
  className?: string
}

/**
 * A pill of mutually exclusive choices. Built on native radio buttons, so arrow keys move
 * between options and screen readers announce it as a radio group.
 */
export function SegmentedControl<V extends string>({
  name,
  value,
  options,
  onValueChange,
  className,
  ...aria
}: SegmentedControlProps<V>): React.JSX.Element {
  return (
    <div
      role="radiogroup"
      className={cn('inline-flex items-center gap-1 rounded-full bg-surface-2 p-1', className)}
      {...aria}
    >
      {options.map(({ value: optionValue, label, icon: Icon }) => (
        <label
          key={optionValue}
          className="relative inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-ink-muted transition-colors select-none hover:text-ink has-checked:bg-surface has-checked:text-ink has-checked:shadow-[0_1px_2px_rgb(23_38_58/0.12)] has-focus-visible:outline-2 has-focus-visible:outline-offset-1 has-focus-visible:outline-primary [&_svg]:size-4"
        >
          <input
            type="radio"
            name={name}
            value={optionValue}
            checked={value === optionValue}
            onChange={() => onValueChange(optionValue)}
            className="sr-only"
          />
          {Icon && <Icon aria-hidden />}
          {label}
        </label>
      ))}
    </div>
  )
}
