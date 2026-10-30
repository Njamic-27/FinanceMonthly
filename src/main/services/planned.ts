import type { Database } from 'better-sqlite3'
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  formatDate,
  startOfMonth,
  startOfWeek,
  type DateRange,
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
import { countedDate } from '@shared/cards'
import { installmentSchedule, installmentTitle } from '@shared/installments'
import { occurrences } from '@shared/recurrence'
import { postedType } from '@shared/recurring'
import { AppError } from '../errors'
import { listAccounts } from '../db/repositories/accounts'
import { chargedDates, listInstallmentPlans } from '../db/repositories/installments'
import { listRecurringItems } from '../db/repositories/recurring'
import { getSettings } from '../db/repositories/settings'
import { getBalanceAt, getSeries, getTotals } from '../db/repositories/stats'
import { cardDueMarkers } from './cards'
import { t } from '@shared/i18n'

// Planned items (PLAN.md §4): payments expected on a date and not settled yet. Calendar,
// reminders and projections all read them from here, so they always agree.

/**
 * Every planned payment due from `from` to `to`, by date. Active recurring items expand into
 * their occurrences from their next due date on (earlier ones were posted or skipped), minus
 * those a transaction already settles, such as one paid early. Paused items have none.
 * Installment plans add each installment not charged yet, and bank loans each installment
 * not paid yet.
 */
export function plannedItems(
  db: Database,
  from: IsoDate,
  to: IsoDate,
  today: IsoDate
): PlannedItem[] {
  // Charges on a card count when its bill is due, like recorded ones (transactions.counts_on).
  const cards = new Map(
    (
      db.prepare('SELECT id, type, statement_day, payment_due_day FROM accounts').all() as {
        id: number
        type: string
        statement_day: number | null
        payment_due_day: number | null
      }[]
    ).map((a) => [
      a.id,
      { type: a.type, statementDay: a.statement_day, paymentDueDay: a.payment_due_day }
    ])
  )
  const counts = (date: IsoDate, accountId: number, group: PlannedItem['group']): IsoDate => {
    const account = cards.get(accountId)
    return account && (group === 'income' || group === 'expense')
      ? countedDate(date, account)
      : date
  }

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
        countsOn: counts(date, item.accountId, postedType(item.kind)),
        title: item.title,
        amount: item.amount,
        group: postedType(item.kind),
        accountId: item.accountId,
        categoryId: item.categoryId,
        overdue: date < today
      })
    }
  }
  // Installments not charged yet. They post by themselves on their date, so one before today
  // is only overdue if posting failed.
  for (const plan of listInstallmentPlans(db)) {
    if (plan.nextDate === null || plan.lastDate < from || plan.nextDate > to) continue
    const charged = chargedDates(db, plan.id)
    for (const { seq, date, amount } of installmentSchedule(
      plan.totalAmount,
      plan.count,
      plan.firstDate
    )) {
      if (date < from || date > to || charged.has(date)) continue
      planned.push({
        source: 'installment_plan',
        sourceId: plan.id,
        date,
        countsOn: counts(date, plan.accountId, 'expense'),
        title: installmentTitle(plan.title, seq, plan.count),
        amount,
        group: 'expense',
        accountId: plan.accountId,
        categoryId: plan.categoryId,
        overdue: date < today
      })
    }
  }
  // Bank loan installments not paid yet, on loans still running.
  const installments = db
    .prepare(
      `SELECT li.id, li.seq, li.due_date, li.amount, l.id AS loan_id, l.title,
              l.installments_count, l.account_id
       FROM loan_installments li JOIN loans l ON l.id = li.loan_id
       WHERE l.status = 'active' AND l.account_id IS NOT NULL
         AND li.due_date BETWEEN ? AND ?
         AND NOT EXISTS (SELECT 1 FROM transactions t WHERE t.loan_installment_id = li.id)`
    )
    .all(from, to) as {
    id: number
    seq: number
    due_date: IsoDate
    amount: number
    loan_id: number
    title: string
    installments_count: number
    account_id: number
  }[]
  for (const row of installments) {
    planned.push({
      source: 'loan_installment',
      sourceId: row.id,
      loanId: row.loan_id,
      date: row.due_date,
      countsOn: row.due_date,
      title: installmentTitle(row.title, row.seq, row.installments_count),
      amount: row.amount,
      group: 'loan',
      accountId: row.account_id,
      categoryId: null,
      overdue: row.due_date < today
    })
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
/**
 * Every planned payment still open up to `to`: overdue ones (from the oldest) and those to
 * come. Payments into or from archived accounts are left out, as the total balance leaves
 * those accounts out. The expected balance and projections both start from this.
 */
export function openPlannedItems(db: Database, to: IsoDate, today: IsoDate): PlannedItem[] {
  const active = new Set(
    listAccounts(db)
      .filter((a) => !a.isArchived)
      .map((a) => a.id)
  )
  // From the oldest payment still open (an overdue one), or today.
  const starts = [
    today,
    ...listRecurringItems(db)
      .filter((item) => item.isActive)
      .map((item) => item.nextDueDate),
    ...listInstallmentPlans(db).flatMap((plan) => plan.nextDate ?? []),
    ...((
      db
        .prepare(
          `SELECT min(li.due_date) AS first FROM loan_installments li
           JOIN loans l ON l.id = li.loan_id
           WHERE l.status = 'active'
             AND NOT EXISTS (SELECT 1 FROM transactions t WHERE t.loan_installment_id = li.id)`
        )
        .get() as { first: IsoDate | null }
    ).first ?? [])
  ]
  const earliest = starts.reduce((min, d) => (d < min ? d : min))
  return plannedItems(db, earliest, to, today).filter((p) => active.has(p.accountId))
}

export function projectedBalance(db: Database, date: IsoDate, today: IsoDate): number {
  return openPlannedItems(db, date, today).reduce(
    (balance, p) => balance + signedPlanned(p),
    getBalanceAt(db, date)
  )
}

/**
 * Planned payments that count in `range`. A card charge counts when its bill is due, at most
 * two months after the charge, so those from the two months before are looked at too.
 */
export function plannedCountedIn(db: Database, range: DateRange, today: IsoDate): PlannedItem[] {
  return plannedItems(db, addMonths(range.start, -2), range.end, today).filter(
    (p) => p.countsOn >= range.start && p.countsOn <= range.end
  )
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
      t('errors.calendarUpTo', {
        month: formatDate(last, locale, { month: 'long', year: 'numeric' })
      })
    )
  }
  const { weekStart } = getSettings(db)
  const grid = { start: startOfWeek(month.start, weekStart), end: endOfWeek(month.end, weekStart) }

  // Everything on the day it counts (PLAN.md step 49): card purchases on their bill's due day,
  // not the day they were bought.
  const days = getSeries(db, { from: grid.start, to: grid.end, by: 'day' }).map((d) => ({
    date: d.start,
    income: d.income,
    expenses: d.expenses,
    savings: d.savingsDeposits + d.savingsWithdrawals,
    loans: d.loansOut + d.loansIn,
    count: d.count
  }))
  const planned = plannedCountedIn(db, grid, today)
  const inMonth = plannedCountedIn(db, month, today)
  const totals = getTotals(db, { from: month.start, to: month.end })
  const projected = month.end >= today

  return {
    month,
    grid,
    days,
    planned,
    cardDues: cardDueMarkers(db, grid.start, grid.end, today),
    summary: {
      income: totals.income,
      expenses: totals.expenses,
      plannedIncome: inMonth.filter((p) => p.group === 'income').reduce((s, p) => s + p.amount, 0),
      // Loan installments aren't spending; they still count in the ending balance.
      plannedExpenses: inMonth
        .filter((p) => p.group === 'expense')
        .reduce((s, p) => s + p.amount, 0),
      overdue: inMonth.filter((p) => p.overdue).length,
      endingBalance: projected
        ? projectedBalance(db, month.end, today)
        : getBalanceAt(db, month.end),
      projected
    }
  }
}
