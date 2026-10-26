import { cn } from '@renderer/lib/utils'

export function Input({ className, ...props }: React.ComponentProps<'input'>): React.JSX.Element {
  return (
    <input
      className={cn(
        'h-10 w-full min-w-0 rounded-control border border-line bg-surface px-3 text-body text-ink transition-colors placeholder:text-ink-muted/70 hover:border-ink-muted/40 focus-visible:border-primary focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-expense',
        className
      )}
      {...props}
    />
  )
}
