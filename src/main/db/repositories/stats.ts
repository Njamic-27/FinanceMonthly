import type { Database } from 'better-sqlite3'
import { eachDay, periodsBetween, type DateRange, type IsoDate } from '@shared/dates'
import {
  categoryTotalsQuerySchema,
  largestQuerySchema,
  statsRangeSchema,
  statsSeriesQuerySchema,
  type CategoryTotal,
  type CategoryTotalsQuery,
  type LargestQuery,
  type PeriodTotals,
  type StatsRange,
  type StatsSeriesQuery,
  type Totals
} from '@shared/stats'
import { signedAmountSql } from '../ledger'
import type { Transaction } from '@shared/transactions'
import { getSettings } from './settings'
import { toTransaction, type TransactionRow } from './transactions'

interface TotalsRow {
  income: number
  expenses: number
  savings_deposits: number
  savings_withdrawals: number
  loans_out: number
  loans_in: number
  count: number
}

const sumOf = (type: string, column: string): string =>
  `coalesce(sum(CASE WHEN t.type = '${type}' THEN t.amount END), 0) AS ${column}`

const totalsColumnsSql = [
  sumOf('income', 'income'),
  sumOf('expense', 'expenses'),
  sumOf('savings_deposit', 'savings_deposits'),
  sumOf('savings_withdrawal', 'savings_withdrawals'),
  sumOf('loan_out', 'loans_out'),
  sumOf('loan_in', 'loans_in'),
  'count(*) AS count'
].join(',\n')

const emptyRow = (): TotalsRow => ({
  income: 0,
  expenses: 0,
  savings_deposits: 0,
  savings_withdrawals: 0,
  loans_out: 0,
  loans_in: 0,
  count: 0
})

function addRow(sum: TotalsRow, row: TotalsRow): void {
  sum.income += row.income
  sum.expenses += row.expenses
  sum.savings_deposits += row.savings_deposits
  sum.savings_withdrawals += row.savings_withdrawals
  sum.loans_out += row.loans_out
  sum.loans_in += row.loans_in
  sum.count += row.count
}

function toTotals(row: TotalsRow): Totals {
  return {
    income: row.income,
    expenses: row.expenses,
    net: row.income - row.expenses,
    savingsDeposits: row.savings_deposits,
    savingsWithdrawals: row.savings_withdrawals,
    loansOut: row.loans_out,
    loansIn: row.loans_in,
    // Transfers leave one account and enter another, so they cancel out.
    cashFlow:
      row.income +
      row.savings_withdrawals +
      row.loans_in -
      row.expenses -
      row.savings_deposits -
      row.loans_out,
    count: row.count
  }
}

/**
 * Every change to the total balance of active accounts: each opening balance on its opening
 * date, then each transaction from the account's opening date on (earlier ones are history
 * the opening balance already includes, as in the account balance query).
 */
const balanceChangesSql = /* sql */ `
  SELECT a.opening_date AS date, a.opening_balance AS delta
  FROM accounts a WHERE a.is_archived = 0
  UNION ALL
  SELECT t.date, ${signedAmountSql('t')}
  FROM transactions t JOIN accounts a ON a.id = t.account_id
  WHERE a.is_archived = 0 AND t.date >= a.opening_date
  UNION ALL
  SELECT t.date, t.amount
  FROM transactions t JOIN accounts a ON a.id = t.to_account_id
  WHERE a.is_archived = 0 AND t.date >= a.opening_date`

/** Totals for every transaction from `from` to `to`, inclusive. */
export function getTotals(db: Database, input: StatsRange): Totals {
  const { from, to } = statsRangeSchema.parse(input)
  const row = db
    .prepare(`SELECT ${totalsColumnsSql} FROM transactions t WHERE t.date BETWEEN @from AND @to`)
    .get({ from, to }) as TotalsRow
  return toTotals(row)
}

/**
 * Totals for each day, week or month from `from` to `to`, including empty ones, in date
 * order. Periods are cut to the range, so a month-to-date range ends with a partial month.
 */
export function getSeries(db: Database, input: StatsSeriesQuery): PeriodTotals[] {
  const { from, to, by } = statsSeriesQuerySchema.parse(input)
  const periods: DateRange[] =
    by === 'day'
      ? eachDay(from, to).map((day) => ({ start: day, end: day }))
      : periodsBetween(by, from, to, getSettings(db).weekStart).map((p) => ({
          start: p.start < from ? from : p.start,
          end: p.end > to ? to : p.end
        }))

  const days = db
    .prepare(
      `SELECT t.date AS date, ${totalsColumnsSql} FROM transactions t
       WHERE t.date BETWEEN @from AND @to GROUP BY t.date ORDER BY t.date`
    )
    .all({ from, to }) as (TotalsRow & { date: IsoDate })[]

  const { before } = db
    .prepare(
      `SELECT coalesce(sum(delta), 0) AS before FROM (${balanceChangesSql}) WHERE date < @from`
    )
    .get({ from }) as { before: number }
  const changes = db
    .prepare(
      `SELECT date, sum(delta) AS delta FROM (${balanceChangesSql})
       WHERE date BETWEEN @from AND @to GROUP BY date ORDER BY date`
    )
    .all({ from, to }) as { date: IsoDate; delta: number }[]

  // Both lists are in date order, as are the periods: walk them side by side.
  let balance = before
  let day = 0
  let change = 0
  return periods.map(({ start, end }) => {
    const sum = emptyRow()
    while (day < days.length && days[day].date <= end) addRow(sum, days[day++])
    while (change < changes.length && changes[change].date <= end) {
      balance += changes[change++].delta
    }
    return { start, end, ...toTotals(sum), balance }
  })
}

/**
 * Income or expense totals per category from `from` to `to`, largest first. Archived
 * categories are included: their transactions still happened.
 */
export function getCategoryTotals(db: Database, input: CategoryTotalsQuery): CategoryTotal[] {
  const { from, to, type } = categoryTotalsQuerySchema.parse(input)
  return db
    .prepare(
      `SELECT t.category_id AS categoryId, sum(t.amount) AS total, count(*) AS count
       FROM transactions t
       WHERE t.type = @type AND t.date BETWEEN @from AND @to
       GROUP BY t.category_id ORDER BY total DESC, t.category_id`
    )
    .all({ from, to, type }) as CategoryTotal[]
}

/** The largest income or expense transactions from `from` to `to`; the earliest first on ties. */
export function getLargest(db: Database, input: LargestQuery): Transaction[] {
  const { from, to, type, limit } = largestQuerySchema.parse(input)
  const rows = db
    .prepare(
      `SELECT t.* FROM transactions t
       WHERE t.type = @type AND t.date BETWEEN @from AND @to
       ORDER BY t.amount DESC, t.date, t.id LIMIT @limit`
    )
    .all({ from, to, type, limit }) as TransactionRow[]
  return rows.map(toTransaction)
}

/** The first day with any data: the earliest transaction or account opening; null when empty. */
export function getFirstDate(db: Database): IsoDate | null {
  const { first } = db
    .prepare(
      `SELECT min(date) AS first FROM (
         SELECT min(date) AS date FROM transactions
         UNION ALL SELECT min(opening_date) FROM accounts)`
    )
    .get() as { first: IsoDate | null }
  return first
}
