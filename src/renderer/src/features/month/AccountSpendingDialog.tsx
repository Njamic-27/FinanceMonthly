import type { Account } from '@shared/accounts'
import { formatDate, type IsoDate } from '@shared/dates'
import { monthRange, type AccountSpending, type MonthKey } from '@shared/month'
import type { DayTotal } from '@shared/transactions'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { useAccounts } from '@renderer/features/accounts/queries'
import { useCategories } from '@renderer/features/categories/queries'
import { useTransactionList } from '@renderer/features/transactions/queries'
import { TransactionList } from '@renderer/features/transactions/TransactionList'
import { useCurrency } from '@renderer/hooks/useCurrency'

function AccountSpendingList({
  month,
  account,
  spending
}: {
  month: MonthKey
  account: Account
  spending: AccountSpending
}): React.JSX.Element {
  const money = useCurrency()
  const accounts = useAccounts().data ?? []
  const categories = useCategories().data ?? []
  const { start, end } = monthRange(month)
  // Expenses counted in the month: for a card, those on the bill due then.
  const list = useTransactionList({ accountId: account.id, kind: 'expense', from: start, to: end })
  const pages = list.data?.pages ?? []
  const transactions = pages.flatMap((p) => p.items)
  const dayTotals = new Map<IsoDate, DayTotal>(
    pages.flatMap((p) => p.dayTotals).map((d) => [d.date, d])
  )

  return (
    <div className="grid gap-4">
      {transactions.length > 0 ? (
        <TransactionList
          transactions={transactions}
          dayTotals={dayTotals}
          accounts={accounts}
          categories={categories}
          accountFilter={account.id}
        />
      ) : (
        list.isSuccess && (
          <p className="rounded-panel border border-dashed border-line p-5 text-center text-sm text-ink-muted">
            Nothing recorded this month.
          </p>
        )
      )}
      {list.hasNextPage && (
        <Button
          variant="outline"
          size="sm"
          className="justify-self-center"
          disabled={list.isFetchingNextPage}
          onClick={() => list.fetchNextPage()}
        >
          Show more
        </Button>
      )}
      <dl className="grid gap-1 border-t border-line pt-3">
        {spending.planned > 0 && (
          <>
            <div className="flex justify-between gap-4 text-sm text-ink-muted">
              <dt>Recorded</dt>
              <dd className="amount">{money.format(spending.recorded)}</dd>
            </div>
            <div className="flex justify-between gap-4 text-sm text-ink-muted">
              <dt>Still planned</dt>
              <dd className="amount">{money.format(spending.planned)}</dd>
            </div>
          </>
        )}
        <div className="flex justify-between gap-4 pb-1">
          <dt className="font-semibold">Total</dt>
          <dd className="amount text-lg">{money.format(spending.recorded + spending.planned)}</dd>
        </div>
      </dl>
    </div>
  )
}

/** One account's spending in the month: its transactions, each editable, and the total. */
export function AccountSpendingDialog({
  month,
  account,
  spending,
  onClose
}: {
  month: MonthKey
  /** null while closed. */
  account: Account | null
  spending: AccountSpending | null
  onClose: () => void
}): React.JSX.Element {
  const money = useCurrency()
  const monthName = formatDate(monthRange(month).start, money.locale, {
    month: 'long',
    year: 'numeric'
  })
  return (
    <Dialog open={account !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[min(36rem,calc(100vw-2rem))]">
        {account && spending && (
          <>
            <DialogHeader>
              <DialogTitle>{account.name}</DialogTitle>
              <DialogDescription>
                {account.type === 'credit'
                  ? `Spending on the bill counted in ${monthName}, with the date of each purchase.`
                  : `Spending paid with it in ${monthName}.`}
              </DialogDescription>
            </DialogHeader>
            <AccountSpendingList month={month} account={account} spending={spending} />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
