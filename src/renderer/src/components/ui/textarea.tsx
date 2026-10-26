import { cn } from '@renderer/lib/utils'

export function Textarea({
  className,
  ...props
}: React.ComponentProps<'textarea'>): React.JSX.Element {
  return (
    <textarea
      className={cn(
        'min-h-20 w-full min-w-0 resize-y rounded-control border border-line bg-surface px-3 py-2 text-body text-ink transition-colors placeholder:text-ink-muted/70 hover:border-ink-muted/40 focus-visible:border-primary focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-expense',
        className
      )}
      {...props}
    />
  )
}
