import { HandCoins, Minus, PiggyBank, TrendingDown, TrendingUp } from 'lucide-react'
import type { Totals } from '@shared/stats'
import { Card } from '@renderer/components/ui/card'
import { useCurrency, type CurrencyTools } from '@renderer/hooks/useCurrency'
import { cn } from '@renderer/lib/utils'
import { relativeChange } from './period'

type Change = { text: string; direction: -1 | 0 | 1 } | null

/**
 * "12% more than September". Kept in muted ink: whether more is good depends on the card,
 * and the money colours are for money kinds only (DESIGN.md).
 */
function changeText(
  current: number,
  previous: number,
  against: string,
  money: CurrencyTools,
  by: 'percent' | 'amount'
): Change {
  if (current === 0 && previous === 0) return null
  if (by === 'percent') {
    const change = relativeChange(current, previous)
    if (change === null) return { text: `Nothing in ${against}`, direction: 1 }
    const percent = new Intl.NumberFormat(money.locale, {
      style: 'percent',
      maximumFractionDigits: 0
    }).format(Math.abs(change))
    if (Math.round(change * 100) === 0)
      return { text: `About the same as ${against}`, direction: 0 }
    return change > 0
      ? { text: `${percent} more than ${against}`, direction: 1 }
      : { text: `${percent} less than ${against}`, direction: -1 }
  }
  const difference = current - previous
  if (difference === 0) return { text: `Same as ${against}`, direction: 0 }
  const amount = money.format(Math.abs(difference))
  return difference > 0
    ? { text: `${amount} higher than ${against}`, direction: 1 }
    : { text: `${amount} lower than ${against}`, direction: -1 }
}

const directionIcons = { [-1]: TrendingDown, 0: Minus, 1: TrendingUp }

function StatCard({
  label,
  value,
  valueClassName,
  change
}: {
  label: string
  value: string
  valueClassName?: string
  change: Change
}): React.JSX.Element {
  const Icon = change ? directionIcons[change.direction] : null
  return (
    <Card>
      <p className="text-sm text-ink-muted">{label}</p>
      <p className={cn('amount mt-1 text-amount', valueClassName)}>{value}</p>
      <p className="mt-2 flex min-h-5 items-center gap-1.5 text-sm text-ink-muted">
        {Icon && <Icon className="size-4 shrink-0" aria-hidden />}
        {change?.text}
      </p>
    </Card>
  )
}

/** Savings and loan movements: not income or spending, but money that moved all the same. */
function OtherMovements({ totals }: { totals: Totals }): React.JSX.Element | null {
  const money = useCurrency()
  const savings = [
    totals.savingsDeposits > 0 && `${money.format(totals.savingsDeposits)} put into savings`,
    totals.savingsWithdrawals > 0 && `${money.format(totals.savingsWithdrawals)} taken out`
  ].filter(Boolean)
  const loans = [
    totals.loansOut > 0 && `${money.format(totals.loansOut)} lent or repaid`,
    totals.loansIn > 0 && `${money.format(totals.loansIn)} borrowed or paid back to you`
  ].filter(Boolean)
  if (savings.length === 0 && loans.length === 0) return null

  return (
    <p className="mt-3 flex flex-wrap gap-x-6 gap-y-1 px-1 text-sm text-ink-muted">
      {savings.length > 0 && (
        <span className="inline-flex items-center gap-1.5">
          <PiggyBank className="size-4 text-savings" aria-hidden />
          Savings: {savings.join(', ')}
        </span>
      )}
      {loans.length > 0 && (
        <span className="inline-flex items-center gap-1.5">
          <HandCoins className="size-4 text-loan" aria-hidden />
          Loans: {loans.join(', ')}
        </span>
      )}
      <span>Not counted as income or spending.</span>
    </p>
  )
}

/** Income, expenses and net for the period, each compared with the previous period. */
export function SummaryCards({
  totals,
  previous,
  against
}: {
  totals: Totals
  /** Totals of the comparison period; undefined while loading or when there's nothing to compare. */
  previous: Totals | undefined
  /** What `previous` covers, as it reads after "more than". */
  against: string
}): React.JSX.Element {
  const money = useCurrency()
  const change = (key: 'income' | 'expenses' | 'net', by: 'percent' | 'amount'): Change =>
    previous ? changeText(totals[key], previous[key], against, money, by) : null

  return (
    <section aria-label="Summary">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Income"
          value={money.format(totals.income)}
          valueClassName={totals.income > 0 ? 'text-income' : undefined}
          change={change('income', 'percent')}
        />
        <StatCard
          label="Spent"
          value={money.format(totals.expenses)}
          change={change('expenses', 'percent')}
        />
        <StatCard
          label="Income minus spending"
          value={money.format(totals.net, 'exceptZero')}
          change={change('net', 'amount')}
        />
      </div>
      <OtherMovements totals={totals} />
    </section>
  )
}
