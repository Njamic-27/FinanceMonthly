import { formatDate, type IsoDate } from '@shared/dates'
import { monthRange, type MonthKey, type MoneyOutLine } from '@shared/month'
import type { DayTotal } from '@shared/transactions'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { useAccounts } from '@renderer/features/accounts/queries'
import { useCategories } from '@renderer/features/categories/queries'
import { TransactionList } from '@renderer/features/transactions/TransactionList'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { useOwnedEditor } from './useOwnedEditor'
import { lineLabel } from './moneyOut'
import { useMoneyOutItems } from './queries'

function LineItems({ month, line }: { month: MonthKey; line: MoneyOutLine }): React.JSX.Element {
  const money = useCurrency()
  const accounts = useAccounts().data ?? []
  const categories = useCategories().data ?? []
  const owned = useOwnedEditor()
  const items = useMoneyOutItems({
    month,
    accountId: line.accountId,
    group: line.group,
    cardId: line.cardId
  })
  const transactions = items.data?.transactions ?? []
  const planned = items.data?.planned ?? []
  const dayTotals = new Map<IsoDate, DayTotal>()
  for (const tx of transactions) {
    const day = dayTotals.get(tx.date) ?? { date: tx.date, income: 0, expenses: 0 }
    if (tx.type === 'expense') day.expenses += tx.amount
    dayTotals.set(tx.date, day)
  }
  const total = line.recorded + line.planned

  return (
    <div className="grid gap-4">
      {transactions.length > 0 && (
        <TransactionList
          transactions={transactions}
          dayTotals={dayTotals}
          accounts={accounts}
          categories={categories}
          onOpenOwned={owned.open}
        />
      )}
      {planned.length > 0 && (
        <section aria-labelledby="line-planned">
          <h3 id="line-planned" className="mb-1 px-1 font-semibold">
            Still to come
          </h3>
          <ul className="divide-y divide-line rounded-panel border border-dashed border-line px-3">
            {planned.map((p, i) => (
              <li key={i} className="flex items-baseline justify-between gap-4 py-2">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{p.title}</span>
                  <span className="text-sm text-ink-muted">
                    {p.date
                      ? formatDate(p.date, money.locale, { day: 'numeric', month: 'short' })
                      : 'Planned this month'}
                  </span>
                </span>
                <span className="amount shrink-0 text-ink-muted">{money.format(p.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {items.isSuccess && transactions.length === 0 && planned.length === 0 && (
        <p className="rounded-panel border border-dashed border-line p-5 text-center text-sm text-ink-muted">
          Nothing here this month.
        </p>
      )}
      <dl className="grid gap-1 border-t border-line pt-3 pb-1">
        {line.planned !== 0 && line.recorded !== 0 && (
          <div className="flex justify-between gap-4 text-sm text-ink-muted">
            <dt>Recorded · still planned</dt>
            <dd className="amount">
              {money.format(line.recorded)} · {money.format(line.planned)}
            </dd>
          </div>
        )}
        <div className="flex justify-between gap-4">
          <dt className="font-semibold">Total</dt>
          <dd className="amount text-lg">
            {total < 0 ? money.format(-total, 'always') : money.format(total)}
          </dd>
        </div>
      </dl>
      {owned.dialogs}
    </div>
  )
}

/**
 * What one money-out line is made of (PLAN.md step 50): its transactions this month, with the
 * date of each purchase and each editable, what's still planned, and the total.
 */
export function MoneyOutLineDialog({
  month,
  line,
  onClose
}: {
  month: MonthKey
  /** null while closed. */
  line: MoneyOutLine | null
  onClose: () => void
}): React.JSX.Element {
  const money = useCurrency()
  const accounts = useAccounts().data ?? []
  const owner = accounts.find((a) => a.id === line?.accountId)
  const monthName = formatDate(monthRange(month).start, money.locale, {
    month: 'long',
    year: 'numeric'
  })
  return (
    <Dialog open={line !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[min(36rem,calc(100vw-2rem))]">
        {line && (
          <>
            <DialogHeader>
              <DialogTitle>{lineLabel(line, accounts)}</DialogTitle>
              <DialogDescription>
                {line.group === 'card'
                  ? `The bill paid from ${owner?.name ?? 'your account'} in ${monthName}: each purchase on it, with the day it was bought.`
                  : `Paid from ${owner?.name ?? 'the account'} in ${monthName}.`}
              </DialogDescription>
            </DialogHeader>
            <LineItems
              key={`${line.accountId}-${line.group}-${line.cardId}`}
              month={month}
              line={line}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
