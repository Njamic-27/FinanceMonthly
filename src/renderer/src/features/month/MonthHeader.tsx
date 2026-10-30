import { useState } from 'react'
import { Minus, Pencil, TrendingDown, TrendingUp } from 'lucide-react'
import { formatDate, type IsoDate } from '@shared/dates'
import type { MonthTotals } from '@shared/month'
import type { CalendarSummary } from '@shared/planned'
import { Card } from '@renderer/components/ui/card'
import { useAccounts } from '@renderer/features/accounts/queries'
import { YourAccountsDialog } from '@renderer/features/accounts/YourAccountsDialog'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { cn } from '@renderer/lib/utils'
import { t } from '@renderer/lib/i18n'

/**
 * The one bold panel: money in your accounts today (debit cards and cash) as the main number,
 * and what's owed on cards beside it, so a card purchase doesn't look as if it already left
 * your accounts. It opens Your accounts to correct balances.
 */
function BalanceTile(): React.JSX.Element {
  const money = useCurrency()
  const accounts = (useAccounts().data ?? []).filter((a) => !a.isArchived)
  const inAccounts = accounts
    .filter((a) => a.type !== 'credit')
    .reduce((sum, a) => sum + a.balance, 0)
  const cards = accounts.filter((a) => a.type === 'credit')
  // What the cards come to together: owed, or in credit after a refund or an overpayment.
  const onCards = cards.reduce((sum, a) => sum + a.balance, 0)
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={t('month.balanceTitle')}
        className="group flex cursor-pointer flex-col rounded-panel bg-banner p-6 text-left text-on-banner transition-[filter] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <span className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <span>
            <span className="block text-on-banner/80">{t('month.moneyInAccounts')}</span>
            <span className="amount mt-1 block text-hero">{money.format(inAccounts)}</span>
          </span>
          {cards.length > 0 && (
            <span className="pb-1.5">
              <span className="block text-sm text-on-banner/80">
                {onCards > 0 ? t('month.inCreditOnCards') : t('month.owedOnCards')}
              </span>
              <span className="amount block text-title">{money.format(Math.abs(onCards))}</span>
            </span>
          )}
        </span>
        <span className="mt-auto flex items-center gap-1.5 pt-3 text-sm text-on-banner/80 group-hover:text-on-banner">
          <Pencil className="size-3.5" aria-hidden />
          {t('month.balanceHint')}
        </span>
      </button>
      <YourAccountsDialog open={open} onClose={() => setOpen(false)} />
    </>
  )
}

/** Income minus money out in the month, with its sign spelled out and an arrow. */
function NetTile({
  month,
  summary,
  totals
}: {
  month: IsoDate
  summary: CalendarSummary
  totals: MonthTotals
}): React.JSX.Element {
  const money = useCurrency()
  const { moneyIn, moneyOut, net, recordedNet, withPlanned } = totals
  const Icon = net > 0 ? TrendingUp : net < 0 ? TrendingDown : Minus
  const name = formatDate(month, money.locale, { month: 'long' })

  return (
    <Card className="flex flex-col p-6">
      <p className="text-ink-muted">
        {t('month.netIn', { month: name })}
        {withPlanned && t('month.withPlanned')}
      </p>
      <p
        className={cn(
          'mt-1 flex items-center gap-3',
          net > 0 && 'text-income',
          net < 0 && 'text-expense'
        )}
      >
        <span className="amount text-hero">{money.format(net, 'exceptZero')}</span>
        <Icon
          className="size-8 shrink-0"
          aria-label={t(net > 0 ? 'month.netUp' : net < 0 ? 'month.netDown' : 'month.netEven')}
        />
      </p>
      <p className="mt-2 text-sm text-ink-muted">
        {t('group.income')} <span className="amount text-ink">{money.format(moneyIn)}</span> ·{' '}
        {t('month.moneyOut')} <span className="amount text-ink">{money.format(moneyOut)}</span>
        {withPlanned && (
          <> · {t('month.recordedSoFar', { amount: money.format(recordedNet, 'exceptZero') })}</>
        )}
      </p>
      <p className="mt-auto pt-2 text-sm text-ink-muted">
        {summary.projected ? t('month.expectedBalanceEnd') : t('month.balanceEnd')}{' '}
        <span className={cn('amount text-ink', summary.endingBalance < 0 && 'text-expense')}>
          {money.format(summary.endingBalance)}
        </span>
      </p>
    </Card>
  )
}

/** The top of Month: money in accounts and owed on cards (click to correct) and the month's net. */
export function MonthHeader({
  month,
  summary,
  totals
}: {
  /** The month's first day. */
  month: IsoDate
  summary: CalendarSummary
  totals: MonthTotals
}): React.JSX.Element {
  return (
    <section aria-label={t('month.balanceAndNet')} className="mb-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <BalanceTile />
        <NetTile month={month} summary={summary} totals={totals} />
      </div>
    </section>
  )
}
