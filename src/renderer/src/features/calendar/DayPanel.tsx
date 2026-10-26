import { CircleAlert, Plus } from 'lucide-react'
import { formatDate, type IsoDate } from '@shared/dates'
import type { PlannedItem } from '@shared/planned'
import type { DayTotal } from '@shared/transactions'
import { Button } from '@renderer/components/ui/button'
import { Card } from '@renderer/components/ui/card'
import { useAccounts } from '@renderer/features/accounts/queries'
import { CategoryChip } from '@renderer/features/categories/CategoryChip'
import { useCategories } from '@renderer/features/categories/queries'
import { openTransactionDialog } from '@renderer/features/transactions/dialogStore'
import { useTransactionList } from '@renderer/features/transactions/queries'
import { TransactionList } from '@renderer/features/transactions/TransactionList'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { cn } from '@renderer/lib/utils'

function PlannedRow({
  item,
  onConfirm
}: {
  item: PlannedItem
  onConfirm: () => void
}): React.JSX.Element {
  const money = useCurrency()
  const category = useCategories().data?.find((c) => c.id === item.categoryId)
  const account = useAccounts().data?.find((a) => a.id === item.accountId)
  const isIncome = item.group === 'income'
  return (
    <li className="flex items-center gap-3 py-2.5">
      {category && <CategoryChip color={category.color} icon={category.icon} size="sm" />}
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{item.title}</p>
        <p className={cn('text-sm text-ink-muted', item.overdue && 'text-expense')}>
          {item.overdue ? 'Overdue' : 'Planned'}
          {account && ` · ${account.name}`}
        </p>
      </div>
      <div className="grid justify-items-end gap-1">
        <span className={cn('amount', isIncome && 'text-income')}>
          {isIncome ? '+' : ''}
          {money.format(item.amount)}
        </span>
        <Button variant="secondary" size="sm" onClick={onConfirm}>
          {isIncome ? 'Mark received…' : 'Mark paid…'}
        </Button>
      </div>
    </li>
  )
}

/** One day: its planned payments, its transactions and "Add transaction" on that date. */
export function DayPanel({
  date,
  planned,
  onConfirm
}: {
  date: IsoDate
  planned: PlannedItem[]
  onConfirm: (item: PlannedItem) => void
}): React.JSX.Element {
  const money = useCurrency()
  const accounts = useAccounts().data ?? []
  const categories = useCategories().data ?? []
  const list = useTransactionList({ from: date, to: date })
  const pages = list.data?.pages ?? []
  const transactions = pages.flatMap((p) => p.items)
  const dayTotals = new Map<IsoDate, DayTotal>(
    pages.flatMap((p) => p.dayTotals).map((d) => [d.date, d])
  )
  const overdue = planned.filter((p) => p.overdue).length

  return (
    <Card
      className="sticky top-6 grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-5"
      aria-label="Selected day"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            {formatDate(date, money.locale, { weekday: 'long', day: 'numeric', month: 'long' })}
          </h2>
          <p className="text-sm text-ink-muted">
            {formatDate(date, money.locale, { year: 'numeric' })}
          </p>
        </div>
        <Button size="sm" onClick={() => openTransactionDialog({ kind: 'new', prefill: { date } })}>
          <Plus />
          Add transaction
        </Button>
      </header>

      {planned.length > 0 && (
        <section aria-labelledby="day-planned">
          <h3 id="day-planned" className="text-sm font-semibold">
            Planned
          </h3>
          {overdue > 0 && (
            <p className="mt-1 flex gap-1.5 text-sm text-expense">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              Not marked paid yet. Mark it paid with what you actually paid, or skip it under
              Recurring.
            </p>
          )}
          <ul className="divide-y divide-line">
            {planned.map((item) => (
              <PlannedRow
                key={`${item.source}-${item.sourceId}`}
                item={item}
                onConfirm={() => onConfirm(item)}
              />
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Transactions">
        {transactions.length > 0 ? (
          <TransactionList
            transactions={transactions}
            dayTotals={dayTotals}
            accounts={accounts}
            categories={categories}
          />
        ) : (
          list.isSuccess && (
            <p className="text-sm text-ink-muted">
              {planned.length > 0 ? 'Nothing recorded yet.' : 'Nothing recorded on this day.'}
            </p>
          )
        )}
        {list.hasNextPage && (
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            disabled={list.isFetchingNextPage}
            onClick={() => list.fetchNextPage()}
          >
            Show more
          </Button>
        )}
      </section>
    </Card>
  )
}
