import type { Database } from 'better-sqlite3'
import { addDays, type IsoDate } from '@shared/dates'
import { formatMoney } from '@shared/money'
import { LOAN_REMINDER_DAYS } from '@shared/loans'
import { plannedRowPath } from '@shared/month'
import type { PlannedItem, UpcomingPayment } from '@shared/planned'
import type { Settings } from '@shared/settings'
import { listRecurringItems } from '../db/repositories/recurring'
import { plannedItems } from './planned'
import { when } from './when'
import { t } from '@shared/i18n'

// Reminders (PLAN.md steps 23 and 32), on top of planned items: a payment whose recurring
// item has `reminder_days_before` set is announced once, on that many days before it falls
// due, and so is each installment of a bank loan you pay by hand, 3 days before.
// notification_log records each announcement, so a restart or the hourly check never
// repeats one.

/** The longest reminder a recurring item can have, in days (see recurringItemInputSchema). */
const MAX_DAYS_BEFORE = 30

/** How far ahead the upcoming list looks, today included. */
export const UPCOMING_DAYS = 14

/** Where a planned item's reminder is logged; null for items without reminders. */
const logSource = (planned: PlannedItem): 'recurring' | 'loan_installment' | null =>
  planned.source === 'recurring' || planned.source === 'loan_installment' ? planned.source : null

/** Planned payments from `from` to `to`, each with its reminder and whether it went off. */
function withReminders(
  db: Database,
  from: IsoDate,
  to: IsoDate,
  today: IsoDate
): UpcomingPayment[] {
  const reminders = new Map(listRecurringItems(db).map((i) => [i.id, i.reminderDaysBefore]))
  // Loans paying automatically need no reminder; card installments charge themselves.
  const manualLoans = new Set(
    (
      db.prepare("SELECT id FROM loans WHERE kind = 'bank_loan' AND auto_pay = 0").all() as {
        id: number
      }[]
    ).map((r) => r.id)
  )
  const notified = db.prepare(
    'SELECT 1 FROM notification_log WHERE source_type = ? AND source_id = ? AND due_date = ?'
  )
  return plannedItems(db, from, to, today).map((planned) => {
    const daysBefore =
      planned.source === 'recurring'
        ? (reminders.get(planned.sourceId) ?? null)
        : planned.source === 'loan_installment' && manualLoans.has(planned.loanId ?? 0)
          ? LOAN_REMINDER_DAYS
          : null
    const source = logSource(planned)
    return {
      planned,
      reminderDaysBefore: daysBefore,
      remindOn: daysBefore === null ? null : addDays(planned.date, -daysBefore),
      notified: source !== null && !!notified.get(source, planned.sourceId, planned.date)
    }
  })
}

/**
 * Planned payments in the next 14 days, today included, by date; first any bank loan
 * installment that's overdue (recurring payments waiting to be confirmed are in Due now).
 */
export function upcomingPayments(db: Database, today: IsoDate): UpcomingPayment[] {
  const overdue = withReminders(db, '1900-01-01', addDays(today, -1), today).filter(
    (p) => p.planned.source === 'loan_installment'
  )
  return [...overdue, ...withReminders(db, today, addDays(today, UPCOMING_DAYS - 1), today)]
}

/**
 * Reminders to announce now: payments due from today on whose reminder day has come and that
 * haven't been announced. A payment already past its due date gets no reminder; it waits in
 * Due now instead.
 */
export function dueReminders(db: Database, today: IsoDate): UpcomingPayment[] {
  return withReminders(db, today, addDays(today, MAX_DAYS_BEFORE), today).filter(
    (p) => p.remindOn !== null && p.remindOn <= today && !p.notified
  )
}

/** Records that these payments' reminders were shown, so they never show again. */
export function markNotified(db: Database, items: PlannedItem[]): void {
  const insert = db.prepare(
    `INSERT INTO notification_log (source_type, source_id, due_date) VALUES (?, ?, ?)
     ON CONFLICT DO NOTHING`
  )
  db.transaction(() => {
    for (const item of items) {
      const source = logSource(item)
      if (source) insert.run(source, item.sourceId, item.date)
    }
  })()
}

/** More reminders than this at once are rolled into one notification. */
const SEPARATE = 3

/** Notification texts for some reminders: one each, or a single summary when there are many. */
export function reminderMessages(
  reminders: UpcomingPayment[],
  accounts: Map<number, string>,
  settings: Pick<Settings, 'currency' | 'locale'>,
  today: IsoDate
): { title: string; body: string; path: string }[] {
  const money = (cents: number): string => formatMoney(cents, settings)
  if (reminders.length > SEPARATE) {
    const lines = reminders.slice(0, SEPARATE).map(({ planned }) =>
      t('reminder.line', {
        title: planned.title,
        amount: money(planned.amount),
        when: when(planned.date, today, settings.locale)
      })
    )
    return [
      {
        title: t('reminder.manyTitle', { count: reminders.length }),
        body: [...lines, t('reminder.andMore', { count: reminders.length - SEPARATE })].join('\n'),
        path: '/'
      }
    ]
  }
  return reminders.map(({ planned }) => ({
    title: t(planned.group === 'income' ? 'reminder.arrives' : 'reminder.isDue', {
      title: planned.title,
      when: when(planned.date, today, settings.locale)
    }),
    body: [money(planned.amount), accounts.get(planned.accountId)].filter(Boolean).join(' · '),
    // Each opens its row on Month, in the month it counts in, where it's paid or confirmed.
    path: plannedRowPath(planned)
  }))
}
