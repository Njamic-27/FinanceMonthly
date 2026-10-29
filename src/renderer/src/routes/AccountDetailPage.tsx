import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { Pencil, Plus } from 'lucide-react'
import { accountTypeLabels, type Account } from '@shared/accounts'
import { addMonths, formatDate, today, type IsoDate } from '@shared/dates'
import type { DayTotal } from '@shared/transactions'
import { BalanceTrend } from '@renderer/components/charts/BalanceTrend'
import { ColorChip } from '@renderer/components/ColorChip'
import { Button } from '@renderer/components/ui/button'
import { Card, CardDescription, CardTitle } from '@renderer/components/ui/card'
import { AccountDialog, type AccountDialogTarget } from '@renderer/features/accounts/AccountDialog'
import { accountTypeIcons } from '@renderer/features/accounts/appearance'
import { CardOverview } from '@renderer/features/accounts/CardOverview'
import { useAccounts, useAccountSeries, useCardStatus } from '@renderer/features/accounts/queries'
import { useCategories } from '@renderer/features/categories/queries'
import { InstallmentPlans } from '@renderer/features/installments/InstallmentPlans'
import { openTransactionDialog } from '@renderer/features/transactions/dialogStore'
import { writeFilters } from '@renderer/features/transactions/filters'
import { useTransactionList } from '@renderer/features/transactions/queries'
import { TransactionList } from '@renderer/features/transactions/TransactionList'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { cn } from '@renderer/lib/utils'

/** The last six months, or since the account opened if that's later. */
function chartRange(account: Account, now: IsoDate): { from: IsoDate; to: IsoDate } {
  const sixMonths = addMonths(now, -6)
  const from = account.openingDate > sixMonths ? account.openingDate : sixMonths
  return { from: from > now ? now : from, to: now }
}

function BalanceTile({ account }: { account: Account }): React.JSX.Element {
  const money = useCurrency()
  return (
    <Card className="grid content-start gap-1">
      <p className="text-sm text-ink-muted">{account.balance < 0 ? 'Overdrawn' : 'Balance'}</p>
      <p className={cn('amount text-amount', account.balance < 0 && 'text-expense')}>
        {money.format(account.balance)}
      </p>
      <p className="text-sm text-ink-muted">
        Started with {money.format(account.openingBalance)} on{' '}
        {formatDate(account.openingDate, money.locale)}
      </p>
    </Card>
  )
}

function AccountTransactions({ account }: { account: Account }): React.JSX.Element {
  const accounts = useAccounts().data ?? []
  const categories = useCategories().data ?? []
  const list = useTransactionList({ accountId: account.id })
  const pages = list.data?.pages ?? []
  const transactions = pages.flatMap((p) => p.items)
  const dayTotals = new Map<IsoDate, DayTotal>(
    pages.flatMap((p) => p.dayTotals).map((d) => [d.date, d])
  )
  const count = pages[0]?.summary?.count ?? 0

  return (
    <section aria-labelledby="account-transactions" className="mt-8 max-w-3xl">
      <header className="mb-4 flex items-baseline justify-between gap-4 px-1">
        <h2 id="account-transactions" className="text-lg font-semibold">
          {count} transaction{count === 1 ? '' : 's'}
        </h2>
        <Link
          to={`/transactions?${writeFilters({ search: '', accountId: account.id })}`}
          className="link text-sm font-semibold text-primary"
        >
          Open in Transactions
        </Link>
      </header>
      {list.isSuccess && transactions.length === 0 ? (
        <p className="rounded-panel border border-dashed border-line p-6 text-ink-muted">
          Nothing paid with or into {account.name} yet.
        </p>
      ) : (
        <TransactionList
          transactions={transactions}
          dayTotals={dayTotals}
          accounts={accounts}
          categories={categories}
          accountFilter={account.id}
        />
      )}
      {list.hasNextPage && (
        <div className="mt-6 flex justify-center">
          <Button
            variant="outline"
            disabled={list.isFetchingNextPage}
            onClick={() => list.fetchNextPage()}
          >
            {list.isFetchingNextPage
              ? 'Loading…'
              : `Show more (${count - transactions.length} left)`}
          </Button>
        </div>
      )}
    </section>
  )
}

function AccountDetail({ account, all }: { account: Account; all: Account[] }): React.JSX.Element {
  const now = today()
  const isCredit = account.type === 'credit'
  const [dialog, setDialog] = useState<AccountDialogTarget | null>(null)
  const card = useCardStatus(account.id, isCredit)
  const series = useAccountSeries({ accountId: account.id, ...chartRange(account, now) })
  const edit = (): void => setDialog({ kind: 'edit', account })
  // Card debt reads better as a positive amount going up and down.
  const points = (series.data ?? []).map((p) => ({
    date: p.date,
    balance: isCredit ? -p.balance : p.balance
  }))

  return (
    <>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <ColorChip color={account.color} icon={accountTypeIcons[account.type]} />
          <div className="min-w-0">
            <h1 className="truncate text-[2rem] leading-tight font-bold">{account.name}</h1>
            <p className="mt-1 text-ink-muted">
              {accountTypeLabels[account.type]}
              {account.isArchived && ' · Archived'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={edit}>
            <Pencil />
            Edit account
          </Button>
          {!account.isArchived && (
            <Button
              onClick={() =>
                openTransactionDialog({ kind: 'new', prefill: { accountId: account.id } })
              }
            >
              <Plus />
              Add transaction
            </Button>
          )}
        </div>
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2">
          {isCredit ? (
            card.data && (
              <CardOverview
                account={account}
                status={card.data}
                payFrom={all.find((a) => a.type === 'debit' && !a.isArchived)}
                onEdit={edit}
              />
            )
          ) : (
            <BalanceTile account={account} />
          )}
        </div>
        <div className="grid gap-4 lg:col-span-3">
          <BalanceTrend points={points} title={isCredit ? 'Owed' : 'Balance'} />
          {isCredit && <InstallmentPlans accountId={account.id} />}
        </div>
      </div>

      <AccountTransactions account={account} />

      <AccountDialog target={dialog} accounts={all} onClose={() => setDialog(null)} />
    </>
  )
}

/** One account: its balance or card overview, a balance chart and its transactions. */
export function AccountDetailPage(): React.JSX.Element | null {
  const { id } = useParams()
  const accounts = useAccounts()
  const all = accounts.data ?? []
  const account = all.find((a) => a.id === Number(id))

  if (accounts.isSuccess && !account) {
    return (
      <Card className="max-w-3xl">
        <CardTitle>That account no longer exists</CardTitle>
        <CardDescription className="mt-1">
          It may have been deleted.{' '}
          <Link to="/accounts" className="link font-semibold text-primary">
            Back to accounts
          </Link>
        </CardDescription>
      </Card>
    )
  }
  return account ? <AccountDetail key={account.id} account={account} all={all} /> : null
}
