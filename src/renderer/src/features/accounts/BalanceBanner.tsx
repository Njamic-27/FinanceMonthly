import type { Account } from '@shared/accounts'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { cn } from '@renderer/lib/utils'
import { t } from '@renderer/lib/i18n'

/** The one bold panel: total balance of the given accounts, split into money and card debt. */
export function BalanceBanner({
  accounts,
  className,
  children
}: {
  accounts: Account[]
  className?: string
  /** Extra content under the figures, e.g. a link. */
  children?: React.ReactNode
}): React.JSX.Element {
  const money = useCurrency()
  const total = accounts.reduce((sum, a) => sum + a.balance, 0)
  const onHand = accounts.filter((a) => a.type !== 'credit').reduce((sum, a) => sum + a.balance, 0)
  const owed = accounts
    .filter((a) => a.type === 'credit')
    .reduce((sum, a) => sum + Math.max(0, -a.balance), 0)

  return (
    <section
      aria-label={t('accounts.totalBalance')}
      className={cn(
        'flex flex-wrap items-end justify-between gap-6 rounded-panel bg-banner p-7 text-on-banner',
        className
      )}
    >
      <div>
        <p className="text-on-banner/80">{t('accounts.totalBalance')}</p>
        <p className="amount mt-1 text-hero">{money.format(total)}</p>
      </div>
      <dl className="flex gap-10">
        <div>
          <dt className="text-sm text-on-banner/80">{t('accounts.cardsAndCash')}</dt>
          <dd className="amount mt-0.5 text-lg">{money.format(onHand)}</dd>
        </div>
        <div>
          <dt className="text-sm text-on-banner/80">{t('accounts.owedOnCreditCards')}</dt>
          <dd className="amount mt-0.5 text-lg">{money.format(owed)}</dd>
        </div>
      </dl>
      {children}
    </section>
  )
}
