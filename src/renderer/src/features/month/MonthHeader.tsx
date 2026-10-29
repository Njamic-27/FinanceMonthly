import { useState } from 'react'
import { Minus, Pencil, TrendingDown, TrendingUp } from 'lucide-react'
import { formatDate, type IsoDate } from '@shared/dates'
import type { CalendarSummary } from '@shared/planned'
import { Card } from '@renderer/components/ui/card'
import { useAccounts } from '@renderer/features/accounts/queries'
import { YourAccountsDialog } from '@renderer/features/accounts/YourAccountsDialog'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { cn } from '@renderer/lib/utils'
import { monthNet } from './cells'

/** Today's total balance, the one bold panel; it opens Your accounts to correct balances. */
function BalanceTile(): React.JSX.Element {
  const money = useCurrency()
  const accounts = (useAccounts().data ?? []).filter((a) => !a.isArchived)
  const total = accounts.reduce((sum, a) => sum + a.balance, 0)
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="See each account and correct its balance"
        className="group flex cursor-pointer flex-col items-start rounded-panel bg-banner p-6 text-left text-on-banner transition-[filter] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <span className="text-on-banner/80">Total balance today</span>
        <span className="amount mt-1 text-hero">{money.format(total)}</span>
        <span className="mt-2 flex items-center gap-1.5 text-sm text-on-banner/80 group-hover:text-on-banner">
          <Pencil className="size-3.5" aria-hidden />
          {accounts.length === 1 ? '1 account' : `${accounts.length} accounts`} · type the real
          balance
        </span>
      </button>
      <YourAccountsDialog open={open} onClose={() => setOpen(false)} />
    </>
  )
}

/** Income minus expenses in the month, with its sign spelled out and an arrow. */
function NetTile({
  month,
  summary
}: {
  month: IsoDate
  summary: CalendarSummary
}): React.JSX.Element {
  const money = useCurrency()
  const { income, expenses, net, recorded, withPlanned } = monthNet(summary)
  const Icon = net > 0 ? TrendingUp : net < 0 ? TrendingDown : Minus
  const name = formatDate(month, money.locale, { month: 'long' })

  return (
    <Card className="flex flex-col p-6">
      <p className="text-ink-muted">
        Net in {name}
        {withPlanned && ', with what’s planned'}
      </p>
      <p
        className={cn(
          'mt-1 flex items-center gap-3',
          net > 0 && 'text-income',
          net < 0 && 'text-expense'
        )}
      >
        <span className="amount text-hero">{money.format(net, 'exceptZero')}</span>
        <Icon className="size-8 shrink-0" aria-label={net > 0 ? 'up' : net < 0 ? 'down' : 'even'} />
      </p>
      <p className="mt-2 text-sm text-ink-muted">
        Income <span className="amount text-ink">{money.format(income)}</span> · Expenses{' '}
        <span className="amount text-ink">{money.format(expenses)}</span>
        {withPlanned && <> · {money.format(recorded, 'exceptZero')} recorded so far</>}
      </p>
      <p className="mt-auto pt-2 text-sm text-ink-muted">
        {summary.projected ? 'Expected balance at month end' : 'Balance at month end'}{' '}
        <span className={cn('amount text-ink', summary.endingBalance < 0 && 'text-expense')}>
          {money.format(summary.endingBalance)}
        </span>
      </p>
    </Card>
  )
}

/** The top of Month: today's total balance (click to correct it) and the month's net. */
export function MonthHeader({
  month,
  summary
}: {
  /** The month's first day. */
  month: IsoDate
  summary: CalendarSummary
}): React.JSX.Element {
  return (
    <section aria-label="Balance and net" className="mb-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <BalanceTile />
        <NetTile month={month} summary={summary} />
      </div>
    </section>
  )
}
