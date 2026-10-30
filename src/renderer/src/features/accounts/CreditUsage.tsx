import { useCurrency } from '@renderer/hooks/useCurrency'
import { cn } from '@renderer/lib/utils'
import { t } from '@renderer/lib/i18n'

/**
 * How much of a card's limit is used: what's owed, then (lighter) what's held for
 * installments still to come, with "€x available of €y" or how far over the limit it is.
 */
export function CreditUsage({
  owed,
  reserved = 0,
  limit,
  available,
  className
}: {
  owed: number
  /** Installments bought on the card and not charged yet. */
  reserved?: number
  limit: number
  available: number
  className?: string
}): React.JSX.Element {
  const money = useCurrency()
  const share = (part: number): number => (limit > 0 ? Math.min(1, Math.max(0, part / limit)) : 0)
  const owedShare = share(owed)
  const reservedShare = Math.min(1 - owedShare, share(reserved))
  const over = owed + reserved - limit

  return (
    <div className={className}>
      <div
        role="meter"
        aria-label={t('accounts.creditUsed')}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={Math.min(owed + reserved, limit)}
        aria-valuetext={t(reserved > 0 ? 'accounts.usageOwedHeld' : 'accounts.usageOwed', {
          owed: money.format(owed),
          held: money.format(reserved),
          limit: money.format(limit)
        })}
        className="flex h-2 overflow-hidden rounded-full bg-surface-2"
      >
        <div className="h-full bg-loan" style={{ width: `${owedShare * 100}%` }} />
        {reservedShare > 0 && (
          <div className="h-full bg-loan/35" style={{ width: `${reservedShare * 100}%` }} />
        )}
      </div>
      <p className={cn('mt-2 text-sm text-ink-muted', over > 0 && 'text-expense')}>
        {over > 0
          ? t('accounts.overLimit', { amount: money.format(over) })
          : t('accounts.availableOf', {
              available: money.format(available),
              limit: money.format(limit)
            })}
      </p>
    </div>
  )
}
