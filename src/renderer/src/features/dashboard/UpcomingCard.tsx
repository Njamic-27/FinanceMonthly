import { useState } from 'react'
import { Link } from 'react-router'
import { addDays, formatDate, today, type IsoDate } from '@shared/dates'
import type { PlannedItem } from '@shared/planned'
import { postedType } from '@shared/recurring'
import { Button } from '@renderer/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@renderer/components/ui/card'
import { useAccounts } from '@renderer/features/accounts/queries'
import { CategoryChip } from '@renderer/features/categories/CategoryChip'
import { useCategories } from '@renderer/features/categories/queries'
import {
  PayInstallmentDialog,
  type PayInstallmentTarget
} from '@renderer/features/loans/PayInstallmentDialog'
import {
  ConfirmPaymentDialog,
  type ConfirmPaymentTarget
} from '@renderer/features/recurring/ConfirmPaymentDialog'
import {
  useDueOccurrences,
  useRecurringItems,
  useUpcomingPayments
} from '@renderer/features/recurring/queries'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { cn } from '@renderer/lib/utils'

/** Rows shown before "+N more". */
const ROWS = 7

interface Row {
  key: string
  planned: PlannedItem
  overdue: boolean
}

function when(date: IsoDate, now: IsoDate, locale: string): string {
  if (date < now) return `Due ${formatDate(date, locale, { day: 'numeric', month: 'short' })}`
  if (date === now) return 'Today'
  if (date === addDays(now, 1)) return 'Tomorrow'
  return formatDate(date, locale, { weekday: 'short', day: 'numeric', month: 'short' })
}

/**
 * What's due now and in the next 14 days: payments waiting to be marked paid first, then the
 * coming ones by date. Recurring payments are marked paid and loan installments paid here;
 * card installments charge themselves.
 */
export function UpcomingCard({ className }: { className?: string }): React.JSX.Element {
  const money = useCurrency()
  const now = today()
  const due = useDueOccurrences().data ?? []
  const upcoming = useUpcomingPayments().data ?? []
  const recurring = useRecurringItems().data ?? []
  const categories = useCategories().data ?? []
  const accounts = useAccounts().data ?? []
  const [confirming, setConfirming] = useState<ConfirmPaymentTarget | null>(null)
  const [paying, setPaying] = useState<PayInstallmentTarget | null>(null)

  // Due now (overdue or today, waiting to be confirmed), then upcoming not already listed.
  const dueKeys = new Set(due.map((d) => `recurring-${d.item.id}-${d.plannedDate}`))
  const rows: Row[] = [
    ...due.map((d) => ({
      key: `due-${d.item.id}-${d.plannedDate}`,
      overdue: d.plannedDate < now,
      planned: {
        source: 'recurring' as const,
        sourceId: d.item.id,
        date: d.plannedDate,
        title: d.item.title,
        amount: d.item.amount,
        group: postedType(d.item.kind),
        accountId: d.item.accountId,
        categoryId: d.item.categoryId,
        overdue: d.plannedDate < now
      }
    })),
    ...upcoming
      .filter((u) => !dueKeys.has(`${u.planned.source}-${u.planned.sourceId}-${u.planned.date}`))
      .map((u) => ({
        key: `${u.planned.source}-${u.planned.sourceId}-${u.planned.date}`,
        planned: u.planned,
        overdue: false
      }))
  ]

  const act = (planned: PlannedItem): void => {
    if (planned.source === 'recurring') {
      const item = recurring.find((r) => r.id === planned.sourceId)
      if (item) setConfirming({ item, plannedDate: planned.date })
    } else if (planned.source === 'loan_installment') {
      setPaying({
        installmentId: planned.sourceId,
        title: planned.title,
        amount: planned.amount,
        dueDate: planned.date,
        accountId: planned.accountId
      })
    }
  }

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader>
        <div>
          <CardTitle>Coming up</CardTitle>
          <CardDescription>Due now and in the next 14 days.</CardDescription>
        </div>
        <Link
          to="/calendar"
          className="rounded-control text-sm font-semibold whitespace-nowrap text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
        >
          Open the calendar
        </Link>
      </CardHeader>

      {rows.length === 0 ? (
        <p className="text-sm text-ink-muted">
          Nothing due in the next two weeks. Bills and subscriptions you add under Recurring show up
          here.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.slice(0, ROWS).map(({ key, planned, overdue }) => {
            const category = categories.find((c) => c.id === planned.categoryId)
            const account = accounts.find((a) => a.id === planned.accountId)
            const isIncome = planned.group === 'income'
            return (
              <li key={key} className="flex items-center gap-3 py-2.5">
                {category ? (
                  <CategoryChip color={category.color} icon={category.icon} size="sm" />
                ) : (
                  <span className="size-7 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{planned.title}</p>
                  <p className={cn('truncate text-sm text-ink-muted', overdue && 'text-expense')}>
                    {when(planned.date, now, money.locale)}
                    {overdue && ' · not marked paid'}
                    {account && ` · ${account.name}`}
                  </p>
                </div>
                <span className={cn('amount shrink-0', isIncome && 'text-income')}>
                  {isIncome ? '+' : ''}
                  {money.format(planned.amount)}
                </span>
                <div className="w-28 shrink-0 text-right">
                  {planned.source === 'installment_plan' ? (
                    <span
                      className="text-xs text-ink-muted"
                      title="Card installments are charged to the card on their date"
                    >
                      Automatic
                    </span>
                  ) : (
                    <Button
                      variant={overdue || planned.date <= now ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => act(planned)}
                    >
                      {planned.source === 'loan_installment'
                        ? 'Pay…'
                        : isIncome
                          ? 'Received…'
                          : 'Mark paid…'}
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {rows.length > ROWS && (
        <p className="mt-2 text-sm text-ink-muted">
          And {rows.length - ROWS} more in the{' '}
          <Link to="/calendar" className="font-semibold text-primary hover:underline">
            calendar
          </Link>
          .
        </p>
      )}

      <ConfirmPaymentDialog target={confirming} onClose={() => setConfirming(null)} />
      <PayInstallmentDialog target={paying} onClose={() => setPaying(null)} />
    </Card>
  )
}
