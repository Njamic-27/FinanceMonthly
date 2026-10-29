import { Link } from 'react-router'
import { Bell, BellOff, BellRing } from 'lucide-react'
import { addDays, formatDate, today, type IsoDate } from '@shared/dates'
import type { UpcomingPayment } from '@shared/planned'
import { Card, CardDescription, CardHeader, CardTitle } from '@renderer/components/ui/card'
import { useAccounts } from '@renderer/features/accounts/queries'
import { CategoryChip } from '@renderer/features/categories/CategoryChip'
import { useCategories } from '@renderer/features/categories/queries'
import { useSettings } from '@renderer/features/settings/queries'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { accountPath, dayPath, plannedPath } from '@renderer/lib/links'
import { cn } from '@renderer/lib/utils'
import { useUpcomingPayments } from './queries'

function dayLabel(date: IsoDate, now: IsoDate, locale: string): string {
  if (date < now) {
    return `Overdue since ${formatDate(date, locale, { weekday: 'long', day: 'numeric', month: 'short' })}`
  }
  if (date === now) return 'Today'
  if (date === addDays(now, 1)) return 'Tomorrow'
  return formatDate(date, locale, { weekday: 'long', day: 'numeric', month: 'short' })
}

function ReminderNote({
  payment,
  now,
  enabled
}: {
  payment: UpcomingPayment
  now: IsoDate
  enabled: boolean
}): React.JSX.Element | null {
  const money = useCurrency()
  const { remindOn, notified } = payment
  if (remindOn === null) return null
  const [Icon, text] = !enabled
    ? [BellOff, 'Reminders are off']
    : notified
      ? [BellRing, 'Reminder sent']
      : remindOn <= now
        ? [BellRing, 'Reminder due']
        : [
            Bell,
            `Reminder ${formatDate(remindOn, money.locale, { weekday: 'short', day: 'numeric', month: 'short' })}`
          ]
  return (
    <span className="flex items-center gap-1 text-xs text-ink-muted">
      <Icon className="size-3.5" aria-hidden />
      {text}
    </span>
  )
}

/** Planned payments in the next 14 days with their reminders. */
export function ComingUp({ className }: { className?: string }): React.JSX.Element {
  const money = useCurrency()
  const upcoming = useUpcomingPayments()
  const categories = useCategories().data ?? []
  const accounts = useAccounts().data ?? []
  const enabled = useSettings().data?.notificationsEnabled ?? true
  const now = today()

  const days: { date: IsoDate; payments: UpcomingPayment[] }[] = []
  for (const payment of upcoming.data ?? []) {
    const day = days.at(-1)
    if (day?.date === payment.planned.date) day.payments.push(payment)
    else days.push({ date: payment.planned.date, payments: [payment] })
  }

  return (
    <Card className={cn('grid content-start gap-4', className)}>
      <CardHeader className="mb-0 block">
        <CardTitle>Coming up</CardTitle>
        <CardDescription>The next 14 days.</CardDescription>
      </CardHeader>

      {upcoming.isSuccess && days.length === 0 && (
        <p className="text-sm text-ink-muted">Nothing planned in the next 14 days.</p>
      )}

      {days.map(({ date, payments }) => (
        <section key={date} aria-label={dayLabel(date, now, money.locale)}>
          <h3 className="mb-1 text-sm font-semibold">
            <Link to={dayPath(date)} className="link">
              {dayLabel(date, now, money.locale)}
            </Link>
          </h3>
          <ul className="divide-y divide-line">
            {payments.map((payment) => {
              const { planned } = payment
              const category = categories.find((c) => c.id === planned.categoryId)
              const account = accounts.find((a) => a.id === planned.accountId)
              const isIncome = planned.group === 'income'
              return (
                <li key={`${planned.source}-${planned.sourceId}`} className="flex gap-3 py-2">
                  {category && (
                    <CategoryChip color={category.color} icon={category.icon} size="sm" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      <Link to={plannedPath(planned)} className="link">
                        {planned.title}
                      </Link>
                    </p>
                    {account && (
                      <p className="truncate text-xs text-ink-muted">
                        <Link to={accountPath(account.id)} className="link">
                          {account.name}
                        </Link>
                      </p>
                    )}
                  </div>
                  <div className="grid justify-items-end gap-0.5">
                    <span className={cn('amount text-sm', isIncome && 'text-income')}>
                      {isIncome ? '+' : ''}
                      {money.format(planned.amount)}
                    </span>
                    <ReminderNote payment={payment} now={now} enabled={enabled} />
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      <Link to="/calendar" className="link justify-self-start text-sm font-semibold text-primary">
        Open the calendar
      </Link>
    </Card>
  )
}
