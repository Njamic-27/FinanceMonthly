import { CircleAlert } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

/** A problem with the whole form, such as the main process refusing it. */
export function FormError({
  message,
  className
}: {
  message: string
  className?: string
}): React.JSX.Element {
  return (
    <p
      role="alert"
      className={cn(
        'flex gap-2.5 rounded-control bg-expense-soft px-3 py-2.5 text-sm text-ink',
        className
      )}
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0 text-expense" aria-hidden />
      {message}
    </p>
  )
}
