import type { Database } from 'better-sqlite3'
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  formatDate,
  startOfMonth,
  startOfWeek,
  type IsoDate
} from '@shared/dates'
import {
  CALENDAR_MONTHS_AHEAD,
  calendarQuerySchema,
  signedPlanned,
  type CalendarMonth,
  type CalendarQuery,
  type PlannedItem
} from '@shared/planned'
import { occurrences } from '@shared/recurrence'
import { postedType } from '@shared/recurring'
import { AppError } from '../errors'
import { listAccounts } from '../db/repositories/accounts'
import { listRecurringItems } from '../db/repositories/recurring'
import { getSettings } from '../db/repositories/settings'
import { getBalanceAt, getSeries, getTotals } from '../db/repositories/stats'

// Planned items (PLAN.md §4): payments expected on a date and not settled yet. Calendar,
// reminders and projections all read them from here, so they always agree.

/**
 * Every planned payment due from `from` to `to`, by date. Active recurring items expand into
 * their occurrences from their next due date on (earlier ones were posted or skipped), minus
 * those a transaction already settles, such as one paid early. Paused items have none.
 */
export function plannedItems(
  db: Database,
  from: IsoDate,
  to: IsoDate,
  today: IsoDate
): PlannedItem[] {
  const settledQuery = db.prepare(
    `SELECT planned_date AS date FROM transactions
     WHERE recurring_item_id = ? AND planned_date BETWEEN ? AND ?`
  )
  const planned: PlannedItem[] = []
  for (const item of listRecurringItems(db)) {
    if (!item.isActive) continue
    const start = item.nextDueDate > from ? item.nextDueDate : from
    if (start > to) continue
    const settled = new Set(
      (settledQuery.all(item.id, start, to) as { date: IsoDate }[]).map((r) => r.date)
    )
    for (const date of occurrences(item, start, to)) {
      if (settled.has(date)) continue
      planned.push({
        source: 'recurring',
        sourceId: item.id,
        date,
        title: item.title,
        amount: item.amount,
        group: postedType(item.kind),
        accountId: item.accountId,
        categoryId: item.categoryId,
        overdue: date < today
      })
    }
  }
  return planned.sort(
    (a, b) =>
      a.date.localeCompare(b.date) || a.title.localeCompare(b.title) || a.sourceId - b.sourceId
  )
}

/**
 * The total balance expected at the end of `date`: the recorded balance then (future-dated
 * transactions included) plus every planned payment due by then, overdue ones included.
 * Payments into or from archived accounts are left out, as the total balance leaves those
 * accounts out.
 */
export function projectedBalance(db: Database, date: IsoDate, today: IsoDate): number {
  const active = new Set(
    listAccounts(db)
      .filter((a) => !a.isArchived)
      .map((a) => a.id)
  )
  const earliest = listRecurringItems(db).reduce<IsoDate>(
    (min, item) => (item.isActive && item.nextDueDate < min ? item.nextDueDate : min),
    date
  )
  return plannedItems(db, earliest, date, today)
    .filter((p) => active.has(p.accountId))
    .reduce((balance, p) => balance + signedPlanned(p), getBalanceAt(db, date))
}

/** Everything the Calendar shows for one month. */
export function calendarMonth(db: Database, input: CalendarQuery, today: IsoDate): CalendarMonth {
  const { month: day } = calendarQuerySchema.parse(input)
  const month = { start: startOfMonth(day), end: endOfMonth(day) }
  const last = startOfMonth(addMonths(startOfMonth(today), CALENDAR_MONTHS_AHEAD))
  if (month.start > last) {
    const { locale } = getSettings(db)
    throw new AppError(
      'validation',
      `The calendar goes up to ${formatDate(last, locale, { month: 'long', year: 'numeric' })}.`
    )
  }
  const { weekStart } = getSettings(db)
  const grid = { start: startOfWeek(month.start, weekStart), end: endOfWeek(month.end, weekStart) }

  const days = getSeries(db, { from: grid.start, to: grid.end, by: 'day' }).map((d) => ({
    date: d.start,
    income: d.income,
    expenses: d.expenses,
    savings: d.savingsDeposits + d.savingsWithdrawals,
    loans: d.loansOut + d.loansIn,
    count: d.count
  }))
  const planned = plannedItems(db, grid.start, grid.end, today)
  const inMonth = planned.filter((p) => p.date >= month.start && p.date <= month.end)
  const totals = getTotals(db, { from: month.start, to: month.end })
  const projected = month.end >= today

  return {
    month,
    grid,
    days,
    planned,
    summary: {
      income: totals.income,
      expenses: totals.expenses,
      plannedIncome: inMonth.filter((p) => p.group === 'income').reduce((s, p) => s + p.amount, 0),
      plannedExpenses: inMonth
        .filter((p) => p.group !== 'income')
        .reduce((s, p) => s + p.amount, 0),
      overdue: inMonth.filter((p) => p.overdue).length,
      endingBalance: projected
        ? projectedBalance(db, month.end, today)
        : getBalanceAt(db, month.end),
      projected
    }
  }
}
