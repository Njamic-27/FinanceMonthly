import { Link } from 'react-router'
import { ArrowLeftRight, Copy, HandCoins, PiggyBank, Scale, type LucideIcon } from 'lucide-react'
import type { Account } from '@shared/accounts'
import { isAdjustment } from '@shared/adjustments'
import type { Category } from '@shared/categories'
import { addDays, formatDate, today, type IsoDate } from '@shared/dates'
import { neutralPaletteColor } from '@shared/palette'
import type { DayTotal, Transaction, TransactionType } from '@shared/transactions'
import { ColorChip } from '@renderer/components/ColorChip'
import { categoryIconComponents } from '@renderer/features/categories/appearance'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { accountPath, categoryPath, dayPath, ownerPath } from '@renderer/lib/links'
import { cn } from '@renderer/lib/utils'
import { countsInMonth } from './countsIn'
import { duplicateTransaction, openTransactionDialog } from './dialogStore'
import { t, tNode } from '@renderer/lib/i18n'

const incoming: TransactionType[] = ['income', 'savings_withdrawal', 'loan_in', 'adjustment_in']

const typeIcons: Partial<Record<TransactionType, LucideIcon>> = {
  transfer: ArrowLeftRight,
  savings_deposit: PiggyBank,
  savings_withdrawal: PiggyBank,
  loan_out: HandCoins,
  loan_in: HandCoins,
  adjustment_in: Scale,
  adjustment_out: Scale
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
  if (date === now) return t('transactions.today')
  if (date === addDays(now, -1)) return t('transactions.yesterday')
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
  accountFilter,
  onOpenOwned
}: {
  tx: Transaction
  lookup: Lookup
  accountFilter?: number
  onOpenOwned?: (tx: Transaction) => void
}): React.JSX.Element {
  const money = useCurrency()
  const category = tx.categoryId ? lookup.categories.get(tx.categoryId) : undefined
  const account = lookup.accounts.get(tx.accountId)
  const toAccount = tx.toAccountId ? lookup.accounts.get(tx.toAccountId) : undefined
  const sign = direction(tx, accountFilter)
  // Balance adjustments open in the same dialog, with their own form.
  const editable =
    tx.type === 'income' || tx.type === 'expense' || tx.type === 'transfer' || isAdjustment(tx.type)
  // A card purchase counts when its bill is due; say so when that's another month.
  const countsIn = countsInMonth(tx.date, tx.countsOn, money.locale)
  // Savings and loan payments are changed on their goal or loan.
  const owner = editable ? null : ownerPath(tx)

  const icon = category
    ? categoryIconComponents[category.icon]
    : (typeIcons[tx.type] ?? ArrowLeftRight)
  // The list's own account isn't a link: it's the page you're on.
  const accountLink = (a: Account | undefined): React.ReactNode => {
    if (!a) return '?'
    if (a.id === accountFilter) return a.name
    return (
      <Link to={accountPath(a.id)} className="link">
        {a.name}
      </Link>
    )
  }
  const details =
    tx.type === 'transfer' ? (
      <>
        {accountLink(account)} → {accountLink(toAccount)}
      </>
    ) : (
      <>
        {category && (
          <Link to={categoryPath(category.id)} className="link">
            {category.name}
          </Link>
        )}
        {category && account && ' · '}
        {account && accountLink(account)}
      </>
    )
  const title = <span className="block truncate font-semibold">{tx.title}</span>
  const coverClass = 'link-cover block w-full min-w-0 text-left'

  return (
    <li className="group flex items-center gap-1">
      <div
        className={cn(
          'relative flex min-w-0 flex-1 items-center gap-3 rounded-control px-2 py-2',
          (editable || owner) && 'link-row'
        )}
      >
        <ColorChip color={category?.color ?? neutralPaletteColor} icon={icon} />
        <span className="min-w-0 flex-1">
          {editable ? (
            <button
              type="button"
              onClick={() => openTransactionDialog({ kind: 'edit', id: tx.id })}
              className={coverClass}
            >
              {title}
            </button>
          ) : owner && onOpenOwned ? (
            <button type="button" onClick={() => onOpenOwned(tx)} className={coverClass}>
              {title}
            </button>
          ) : owner ? (
            <Link to={owner} className={coverClass}>
              {title}
            </Link>
          ) : (
            title
          )}
          <span className="block truncate text-sm text-ink-muted">
            {details}
            {countsIn && t('transactions.countsInShort', { month: countsIn })}
            {tx.note && <span className="italic"> · {tx.note}</span>}
          </span>
        </span>
        <span
          className={cn('amount shrink-0 text-base whitespace-nowrap', sign > 0 && 'text-income')}
        >
          {sign === 0 ? money.format(tx.amount) : money.format(sign * tx.amount, 'exceptZero')}
        </span>
      </div>
      {editable && !isAdjustment(tx.type) ? (
        <button
          type="button"
          aria-label={t('transactions.duplicateTitle', { title: tx.title })}
          title={t('transactions.duplicate')}
          onClick={() => duplicateTransaction(tx)}
          className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-control text-ink-muted opacity-0 transition hover:bg-surface-2 hover:text-ink group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-primary"
        >
          <Copy className="size-4" />
        </button>
      ) : (
        // Keeps amounts in one column with the rows that can be duplicated.
        <span className="size-9 shrink-0" aria-hidden />
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
  /** Day headings open the day in the Calendar; off where the list is that day already. */
  linkDays?: boolean
  /**
   * Opens a savings or loan movement where the list is, instead of going to its goal or
   * loan's page.
   */
  onOpenOwned?: (tx: Transaction) => void
}

/** Transactions grouped by day, newest first, each day with its income and expense totals. */
export function TransactionList({
  transactions,
  dayTotals,
  accounts,
  categories,
  accountFilter,
  linkDays = true,
  onOpenOwned
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
    // minmax(0, 1fr): long titles truncate instead of widening narrow places like a side panel.
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      {days.map(({ date, items }) => {
        const totals = dayTotals.get(date)
        return (
          <section key={date} aria-label={dayLabel(date, money.locale)}>
            <header className="mb-2 flex items-baseline justify-between gap-4 px-1">
              <h2 className="text-base font-semibold">
                {linkDays ? (
                  <Link to={dayPath(date)} className="link">
                    {dayLabel(date, money.locale)}
                  </Link>
                ) : (
                  dayLabel(date, money.locale)
                )}
              </h2>
              <p className="flex gap-4 text-sm text-ink-muted">
                {totals && totals.income > 0 && (
                  <span>
                    {tNode('transactions.dayIn', {
                      amount: (
                        <span className="amount text-income">{money.format(totals.income)}</span>
                      )
                    })}
                  </span>
                )}
                {totals && totals.expenses > 0 && (
                  <span>
                    {tNode('transactions.dayOut', {
                      amount: (
                        <span className="amount text-ink">{money.format(totals.expenses)}</span>
                      )
                    })}
                  </span>
                )}
              </p>
            </header>
            <ul className="divide-y divide-line rounded-panel border border-line bg-surface p-2">
              {items.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  lookup={lookup}
                  accountFilter={accountFilter}
                  onOpenOwned={onOpenOwned}
                />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
