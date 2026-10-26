import { ArrowLeftRight, Copy, HandCoins, PiggyBank, type LucideIcon } from 'lucide-react'
import type { Account } from '@shared/accounts'
import type { Category } from '@shared/categories'
import { addDays, formatDate, today, type IsoDate } from '@shared/dates'
import { neutralPaletteColor } from '@shared/palette'
import type { DayTotal, Transaction, TransactionType } from '@shared/transactions'
import { ColorChip } from '@renderer/components/ColorChip'
import { categoryIconComponents } from '@renderer/features/categories/appearance'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { cn } from '@renderer/lib/utils'
import { duplicateTransaction, openTransactionDialog } from './dialogStore'

const incoming: TransactionType[] = ['income', 'savings_withdrawal', 'loan_in']

const typeIcons: Partial<Record<TransactionType, LucideIcon>> = {
  transfer: ArrowLeftRight,
  savings_deposit: PiggyBank,
  savings_withdrawal: PiggyBank,
  loan_out: HandCoins,
  loan_in: HandCoins
}

/**
 * +1 money in, −1 money out, 0 neither. A transfer only has a direction when the list is
 * filtered to one of its accounts.
 */
function direction(tx: Transaction, accountFilter?: number): 1 | -1 | 0 {
  if (tx.type === 'transfer') {
    if (accountFilter === tx.toAccountId) return 1
    if (accountFilter === tx.accountId) return -1
    return 0
  }
  return incoming.includes(tx.type) ? 1 : -1
}

function dayLabel(date: IsoDate, locale: string): string {
  const now = today()
  if (date === now) return 'Today'
  if (date === addDays(now, -1)) return 'Yesterday'
  return formatDate(date, locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(date.slice(0, 4) !== now.slice(0, 4) && { year: 'numeric' })
  })
}

interface Lookup {
  accounts: Map<number, Account>
  categories: Map<number, Category>
}

function TransactionRow({
  tx,
  lookup,
  accountFilter
}: {
  tx: Transaction
  lookup: Lookup
  accountFilter?: number
}): React.JSX.Element {
  const money = useCurrency()
  const category = tx.categoryId ? lookup.categories.get(tx.categoryId) : undefined
  const account = lookup.accounts.get(tx.accountId)
  const toAccount = tx.toAccountId ? lookup.accounts.get(tx.toAccountId) : undefined
  const sign = direction(tx, accountFilter)
  const editable = tx.type === 'income' || tx.type === 'expense'

  const icon = category
    ? categoryIconComponents[category.icon]
    : (typeIcons[tx.type] ?? ArrowLeftRight)
  const details =
    tx.type === 'transfer'
      ? `${account?.name ?? '?'} → ${toAccount?.name ?? '?'}`
      : [category?.name, account?.name].filter(Boolean).join(' · ')

  const content = (
    <>
      <ColorChip color={category?.color ?? neutralPaletteColor} icon={icon} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{tx.title}</span>
        <span className="block truncate text-sm text-ink-muted">
          {details}
          {tx.note && <span className="italic"> · {tx.note}</span>}
        </span>
      </span>
      <span
        className={cn('amount shrink-0 text-base whitespace-nowrap', sign > 0 && 'text-income')}
      >
        {sign === 0 ? money.format(tx.amount) : money.format(sign * tx.amount, 'exceptZero')}
      </span>
    </>
  )
  const rowClass = 'flex min-w-0 flex-1 items-center gap-3 rounded-control px-2 py-2 text-left'

  return (
    <li className="group flex items-center gap-1">
      {editable ? (
        <button
          type="button"
          onClick={() => openTransactionDialog({ kind: 'edit', id: tx.id })}
          className={cn(
            rowClass,
            'cursor-pointer transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary'
          )}
        >
          {content}
        </button>
      ) : (
        <div className={rowClass}>{content}</div>
      )}
      {editable && (
        <button
          type="button"
          aria-label={`Duplicate “${tx.title}”`}
          title="Duplicate"
          onClick={() => duplicateTransaction(tx)}
          className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-control text-ink-muted opacity-0 transition hover:bg-surface-2 hover:text-ink group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-primary"
        >
          <Copy className="size-4" />
        </button>
      )}
    </li>
  )
}

interface TransactionListProps {
  transactions: Transaction[]
  dayTotals: Map<IsoDate, DayTotal>
  accounts: Account[]
  categories: Category[]
  /** Set when the list shows one account, so transfers read as in or out. */
  accountFilter?: number
}

/** Transactions grouped by day, newest first, each day with its income and expense totals. */
export function TransactionList({
  transactions,
  dayTotals,
  accounts,
  categories,
  accountFilter
}: TransactionListProps): React.JSX.Element {
  const money = useCurrency()
  const lookup: Lookup = {
    accounts: new Map(accounts.map((a) => [a.id, a])),
    categories: new Map(categories.map((c) => [c.id, c]))
  }

  const days: { date: IsoDate; items: Transaction[] }[] = []
  for (const tx of transactions) {
    const day = days.at(-1)
    if (day?.date === tx.date) day.items.push(tx)
    else days.push({ date: tx.date, items: [tx] })
  }

  return (
    <div className="grid gap-6">
      {days.map(({ date, items }) => {
        const totals = dayTotals.get(date)
        return (
          <section key={date} aria-label={dayLabel(date, money.locale)}>
            <header className="mb-2 flex items-baseline justify-between gap-4 px-1">
              <h2 className="text-base font-semibold">{dayLabel(date, money.locale)}</h2>
              <p className="flex gap-4 text-sm text-ink-muted">
                {totals && totals.income > 0 && (
                  <span>
                    In <span className="amount text-income">{money.format(totals.income)}</span>
                  </span>
                )}
                {totals && totals.expenses > 0 && (
                  <span>
                    Out <span className="amount text-ink">{money.format(totals.expenses)}</span>
                  </span>
                )}
              </p>
            </header>
            <ul className="divide-y divide-line rounded-panel border border-line bg-surface p-2">
              {items.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} lookup={lookup} accountFilter={accountFilter} />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
