import { useCurrency } from '@renderer/hooks/useCurrency'
import { cn } from '@renderer/lib/utils'

/** How much of a card's limit is used: a meter and "€x available of €y", or how far over. */
export function CreditUsage({
  owed,
  limit,
  available,
  className
}: {
  owed: number
  limit: number
  available: number
  className?: string
}): React.JSX.Element {
  const money = useCurrency()
  const share = limit > 0 ? Math.min(1, owed / limit) : 0
  const over = owed - limit

  return (
    <div className={className}>
      <div
        role="meter"
        aria-label="Credit used"
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={Math.min(owed, limit)}
        aria-valuetext={`${money.format(owed)} of ${money.format(limit)}`}
        className="h-2 overflow-hidden rounded-full bg-surface-2"
      >
        <div className="h-full rounded-full bg-loan" style={{ width: `${share * 100}%` }} />
      </div>
      <p className={cn('mt-2 text-sm text-ink-muted', over > 0 && 'text-expense')}>
        {over > 0
          ? `Over the limit by ${money.format(over)}`
          : `${money.format(available)} available of ${money.format(limit)}`}
      </p>
    </div>
  )
}
