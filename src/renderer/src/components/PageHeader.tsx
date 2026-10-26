import { cn } from '@renderer/lib/utils'

interface PageHeaderProps {
  title: string
  description?: string
  /** Buttons or controls shown on the right. */
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({
  title,
  description,
  actions,
  className
}: PageHeaderProps): React.JSX.Element {
  return (
    <header className={cn('mb-8 flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        <h1 className="text-[2rem] leading-tight font-bold">{title}</h1>
        {description && <p className="mt-1 text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  )
}
