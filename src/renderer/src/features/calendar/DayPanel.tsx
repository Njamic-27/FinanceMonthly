import { Link } from 'react-router'
import { ChevronRight, CircleAlert, CreditCard, Plus } from 'lucide-react'
import { formatDate, type IsoDate } from '@shared/dates'
import type { CardDueMarker, PlannedItem } from '@shared/planned'
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
import { accountPath, plannedPath } from '@renderer/lib/links'
import { cn } from '@renderer/lib/utils'
import { cardDueLabel } from './cardDue'
import { t } from '@renderer/lib/i18n'

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
        <p className="truncate font-semibold">
          <Link to={plannedPath(item)} className="link">
            {item.title}
          </Link>
        </p>
        <p className={cn('truncate text-sm text-ink-muted', item.overdue && 'text-expense')}>
          {item.source === 'installment_plan'
            ? t('calendar.installmentChargedAutomatically')
            : item.source === 'loan_installment'
              ? item.overdue
                ? t('calendar.loanInstallmentOverdue')
                : t('calendar.loanInstallment')
              : item.overdue
                ? t('common.overdue')
                : t('common.planned')}
          {account && (
            <>
              {' · '}
              <Link to={accountPath(account.id)} className="link">
                {account.name}
              </Link>
            </>
          )}
        </p>
      </div>
      <div className="grid justify-items-end gap-1">
        <span className={cn('amount', isIncome && 'text-income')}>
          {isIncome ? '+' : ''}
          {money.format(item.amount)}
        </span>
        <Button variant="secondary" size="sm" onClick={onConfirm}>
          {item.source === 'installment_plan'
            ? t('calendar.viewCard')
            : item.source === 'loan_installment'
              ? t('month.pay')
              : isIncome
                ? t('month.markReceived')
                : t('month.markPaid')}
        </Button>
      </div>
    </li>
  )
}

/** One day: its planned payments, its transactions and "Add transaction" on that date. */
export function DayPanel({
  ref,
  date,
  cardDues,
  planned,
  onConfirm
}: {
  ref?: React.Ref<HTMLElement>
  date: IsoDate
  cardDues: CardDueMarker[]
  planned: PlannedItem[]
  onConfirm: (item: PlannedItem) => void
}): React.JSX.Element {
  const money = useCurrency()
  const accounts = useAccounts().data ?? []
  const categories = useCategories().data ?? []
  // What counts on the day: on a card bill's due day, the purchases on that bill.
  const list = useTransactionList({ from: date, to: date })
  const pages = list.data?.pages ?? []
  const transactions = pages.flatMap((p) => p.items)
  const dayTotals = new Map<IsoDate, DayTotal>(
    pages.flatMap((p) => p.dayTotals).map((d) => [d.date, d])
  )
  // Only recurring payments wait to be marked paid or skipped; the note is about them.
  const overdue = planned.filter((p) => p.overdue && p.source === 'recurring').length

  return (
    <Card
      ref={ref}
      className="sticky top-6 grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-5"
      aria-label={t('calendar.selectedDay')}
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
          {t('shell.addTransaction')}
        </Button>
      </header>

      {cardDues.length > 0 && (
        <section aria-labelledby="day-cards">
          <h3 id="day-cards" className="text-sm font-semibold">
            {t('calendar.cardPaymentsDue')}
          </h3>
          <p className="mt-1 text-sm text-ink-muted">{t('calendar.payingACardMoves')}</p>
          <ul className="mt-1">
            {cardDues.map((marker) => (
              <li key={marker.accountId}>
                <Link
                  to={accountPath(marker.accountId)}
                  className="link-row -mx-2 flex items-center gap-3 px-2 py-2"
                >
                  <span className="flex size-7 items-center justify-center rounded-full bg-surface-2">
                    <CreditCard className="size-4 text-ink-muted" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 truncate font-semibold">
                    {cardDueLabel(marker, money)}
                  </span>
                  <ChevronRight className="size-4 text-ink-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {planned.length > 0 && (
        <section aria-labelledby="day-planned">
          <h3 id="day-planned" className="text-sm font-semibold">
            {t('common.planned')}
          </h3>
          {overdue > 0 && (
            <p className="mt-1 flex gap-1.5 text-sm text-expense">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {t('calendar.notMarkedPaidYet')}
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

      <section aria-label={t('screen.transactions')}>
        {transactions.length > 0 ? (
          <TransactionList
            transactions={transactions}
            dayTotals={dayTotals}
            accounts={accounts}
            categories={categories}
            linkDays={false}
          />
        ) : (
          list.isSuccess && (
            <p className="text-sm text-ink-muted">
              {planned.length + cardDues.length > 0
                ? t('calendar.nothingRecordedYet')
                : t('calendar.nothingRecordedOnThis')}
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
            {t('calendar.showMore')}
          </Button>
        )}
      </section>
    </Card>
  )
}
