import { cn } from '@renderer/lib/utils'

export function Card({ className, ...props }: React.ComponentProps<'section'>): React.JSX.Element {
  return (
    <section
      className={cn('rounded-panel border border-line bg-surface p-5 text-ink', className)}
      {...props}
    />
  )
}

export function CardHeader({
  className,
  ...props
}: React.ComponentProps<'div'>): React.JSX.Element {
  return <div className={cn('mb-4 flex items-start justify-between gap-3', className)} {...props} />
}

export function CardTitle({ className, ...props }: React.ComponentProps<'h2'>): React.JSX.Element {
  return <h2 className={cn('text-lg font-semibold', className)} {...props} />
}

export function CardDescription({
  className,
  ...props
}: React.ComponentProps<'p'>): React.JSX.Element {
  return <p className={cn('text-sm text-ink-muted', className)} {...props} />
}

export function CardContent({
  className,
  ...props
}: React.ComponentProps<'div'>): React.JSX.Element {
  return <div className={cn(className)} {...props} />
}

export function CardFooter({
  className,
  ...props
}: React.ComponentProps<'div'>): React.JSX.Element {
  return <div className={cn('mt-5 flex items-center gap-2', className)} {...props} />
}
