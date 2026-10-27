import { Link } from 'react-router'
import { ChevronRight, Plus } from 'lucide-react'
import { formatDate, today, type IsoDate } from '@shared/dates'
import { monthRange, summaryDate, type MonthKey, type MonthSheetRow } from '@shared/month'
import type { DayTotal } from '@shared/transactions'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { useAccounts } from '@renderer/features/accounts/queries'
import { useCategories } from '@renderer/features/categories/queries'
import {
  openTransactionDialog,
  type TransactionPrefill
} from '@renderer/features/transactions/dialogStore'
import { TransactionList } from '@renderer/features/transactions/TransactionList'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { useMonthRowTransactions } from './queries'

/** Where a row's own page is, for rows whose payments are managed there. */
function rowPage(row: MonthSheetRow): { to: string; label: string } | null {
  switch (row.kind) {
    case 'recurring':
      return { to: '/recurring', label: 'Open Recurring' }
    case 'card_payment':
      return { to: `/accounts/${row.sourceId}`, label: 'Open card' }
    case 'installment_plan':
      return row.accountId === null
        ? null
        : { to: `/accounts/${row.accountId}`, label: 'Open card' }
    case 'loan':
      return { to: `/loans/${row.sourceId}`, label: 'Open loan' }
    case 'savings':
      return { to: `/savings/${row.sourceId}`, label: 'Open goal' }
    default:
      return null
  }
}

/** One row's transactions in the month, each editable, with "Add transaction". */
export function RowPanel({
  month,
  row,
  onClose
}: {
  month: MonthKey
  row: MonthSheetRow | null
  onClose: () => void
}): React.JSX.Element {
  const money = useCurrency()
  const accounts = useAccounts().data ?? []
  const categories = useCategories().data ?? []
  const list = useMonthRowTransactions(row && { month, kind: row.kind, sourceId: row.sourceId })
  const transactions = list.data ?? []

  const dayTotals = new Map<IsoDate, DayTotal>()
  for (const tx of transactions) {
    const day = dayTotals.get(tx.date) ?? { date: tx.date, income: 0, expenses: 0 }
    if (tx.type === 'income') day.income += tx.amount
    if (tx.type === 'expense') day.expenses += tx.amount
    dayTotals.set(tx.date, day)
  }

  const category = categories.find((c) => c.id === row?.categoryId)
  const date = summaryDate(month, today())
  // New transactions land in this row: a purchase in its category, or a payment to its card.
  const prefill: TransactionPrefill | null =
    row?.kind === 'category' && category
      ? {
          type: category.type,
          categoryId: category.id,
          accountId: row.accountId ?? undefined,
          date
        }
      : row?.kind === 'card_payment'
        ? {
            type: 'transfer',
            toAccountId: row.sourceId,
            accountId: row.accountId ?? undefined,
            date
          }
        : null
  const page = row && rowPage(row)
  const monthLabel = formatDate(monthRange(month).start, money.locale, {
    month: 'long',
    year: 'numeric'
  })

  return (
    <Dialog open={row !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[min(36rem,calc(100vw-2rem))]">
        {row && (
          <>
            <DialogHeader>
              <DialogTitle>{row.title}</DialogTitle>
              <DialogDescription>
                {monthLabel} · {row.count === 1 ? '1 transaction' : `${row.count} transactions`}
                {row.summary !== 0 && `, ${money.format(row.summary)} of it typed on the sheet`}
              </DialogDescription>
            </DialogHeader>

            {list.isError ? (
              <p className="text-sm text-expense">{list.error.message}</p>
            ) : transactions.length > 0 ? (
              <TransactionList
                transactions={transactions}
                dayTotals={dayTotals}
                accounts={accounts}
                categories={categories}
              />
            ) : (
              !list.isPending && (
                <p className="rounded-panel border border-dashed border-line p-6 text-center text-ink-muted">
                  Nothing recorded here this month.
                  {prefill && ' Type an amount on the sheet, or add a transaction.'}
                </p>
              )
            )}

            {(prefill || page) && (
              <DialogFooter>
                {page && (
                  <Button variant="ghost" asChild>
                    <Link to={page.to} onClick={onClose}>
                      {page.label}
                      <ChevronRight />
                    </Link>
                  </Button>
                )}
                {prefill && (
                  <Button onClick={() => openTransactionDialog({ kind: 'new', prefill })}>
                    <Plus />
                    Add transaction
                  </Button>
                )}
              </DialogFooter>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
