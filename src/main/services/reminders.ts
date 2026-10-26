import type { Database } from 'better-sqlite3'
import { addDays, daysBetween, formatDate, type IsoDate } from '@shared/dates'
import { formatMoney } from '@shared/money'
import type { PlannedItem, UpcomingPayment } from '@shared/planned'
import type { Settings } from '@shared/settings'
import { listRecurringItems } from '../db/repositories/recurring'
import { plannedItems } from './planned'

// Reminders (PLAN.md step 23), on top of planned items: a payment whose recurring item has
// `reminder_days_before` set is announced once, on that many days before it falls due.
// notification_log records each announcement, so a restart or the hourly check never
// repeats one.

/** The longest reminder a recurring item can have, in days (see recurringItemInputSchema). */
const MAX_DAYS_BEFORE = 30

/** How far ahead the upcoming list looks, today included. */
export const UPCOMING_DAYS = 14

/** Planned payments from `today` for `days` days, each with its reminder and whether it went off. */
function withReminders(db: Database, today: IsoDate, days: number): UpcomingPayment[] {
  const reminders = new Map(listRecurringItems(db).map((i) => [i.id, i.reminderDaysBefore]))
  const notified = db.prepare(
    "SELECT 1 FROM notification_log WHERE source_type = 'recurring' AND source_id = ? AND due_date = ?"
  )
  return plannedItems(db, today, addDays(today, days - 1), today).map((planned) => {
    const daysBefore = reminders.get(planned.sourceId) ?? null
    return {
      planned,
      reminderDaysBefore: daysBefore,
      remindOn: daysBefore === null ? null : addDays(planned.date, -daysBefore),
      notified: !!notified.get(planned.sourceId, planned.date)
    }
  })
}

/** Planned payments in the next 14 days, today included, by date. */
export function upcomingPayments(db: Database, today: IsoDate): UpcomingPayment[] {
  return withReminders(db, today, UPCOMING_DAYS)
}

/**
 * Reminders to announce now: payments due from today on whose reminder day has come and that
 * haven't been announced. A payment already past its due date gets no reminder; it waits in
 * Due now instead.
 */
export function dueReminders(db: Database, today: IsoDate): UpcomingPayment[] {
  return withReminders(db, today, MAX_DAYS_BEFORE + 1).filter(
    (p) => p.remindOn !== null && p.remindOn <= today && !p.notified
  )
}

/** Records that these payments' reminders were shown, so they never show again. */
export function markNotified(db: Database, items: PlannedItem[]): void {
  const insert = db.prepare(
    `INSERT INTO notification_log (source_type, source_id, due_date) VALUES ('recurring', ?, ?)
     ON CONFLICT DO NOTHING`
  )
  db.transaction(() => {
    for (const item of items) insert.run(item.sourceId, item.date)
  })()
}

/** More reminders than this at once are rolled into one notification. */
const SEPARATE = 3

function when(date: IsoDate, today: IsoDate, locale: string): string {
  const days = daysBetween(today, date)
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  return `on ${formatDate(date, locale, { weekday: 'long', day: 'numeric', month: 'short' })}`
}

/** Notification texts for some reminders: one each, or a single summary when there are many. */
export function reminderMessages(
  reminders: UpcomingPayment[],
  accounts: Map<number, string>,
  settings: Pick<Settings, 'currency' | 'locale'>,
  today: IsoDate
): { title: string; body: string }[] {
  const money = (cents: number): string => formatMoney(cents, settings)
  if (reminders.length > SEPARATE) {
    const lines = reminders
      .slice(0, SEPARATE)
      .map(
        ({ planned }) =>
          `${planned.title} ${money(planned.amount)}, ${when(planned.date, today, settings.locale)}`
      )
    return [
      {
        title: `${reminders.length} payments coming up`,
        body: [...lines, `and ${reminders.length - SEPARATE} more`].join('\n')
      }
    ]
  }
  return reminders.map(({ planned }) => ({
    title: `${planned.title} ${planned.group === 'income' ? 'arrives' : 'is due'} ${when(planned.date, today, settings.locale)}`,
    body: [money(planned.amount), accounts.get(planned.accountId)].filter(Boolean).join(' · ')
  }))
}
