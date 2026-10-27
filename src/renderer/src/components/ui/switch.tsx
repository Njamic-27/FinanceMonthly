import { cn } from '@renderer/lib/utils'

interface SwitchProps {
  id?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  'aria-describedby'?: string
  /** When no <label for> names it. */
  'aria-label'?: string
  className?: string
}

/** An on/off toggle. A button with role="switch", so Space and Enter flip it. */
export function Switch({
  id,
  checked,
  onCheckedChange,
  disabled,
  className,
  ...aria
}: SwitchProps): React.JSX.Element {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-ink-muted/40',
        className
      )}
      {...aria}
    >
      <span
        aria-hidden
        className={cn(
          'inline-block size-5 rounded-full bg-surface shadow-[0_1px_2px_rgb(23_38_58/0.25)] transition-transform motion-reduce:transition-none',
          checked ? 'translate-x-5.5' : 'translate-x-0.5'
        )}
      />
    </button>
  )
}
