import type { Database } from 'better-sqlite3'
import type { IsoDate } from '@shared/dates'
import {
  monthRange,
  monthSheetQuerySchema,
  type AccountSpending,
  type MonthSheetQuery
} from '@shared/month'
import { plannedCountedIn } from './planned'

/**
 * The month's spending by the account it was paid with (PLAN.md step 46): expenses counted in
 * the month, so card purchases on the bill due then, and the planned ones still to come. Added
 * up as the Expenses total is (planned only for the current and later months), every account's
 * comes to the month's expenses.
 */
export function spendingByAccount(
  db: Database,
  input: MonthSheetQuery,
  today: IsoDate
): AccountSpending[] {
  const { month } = monthSheetQuerySchema.parse(input)
  const range = monthRange(month)
  const recorded = db
    .prepare(
      `SELECT account_id AS accountId, sum(amount) AS recorded, count(*) AS count
       FROM transactions
       WHERE type = 'expense' AND counts_on BETWEEN ? AND ?
       GROUP BY account_id`
    )
    .all(range.start, range.end) as { accountId: number; recorded: number; count: number }[]

  const byAccount = new Map<number, AccountSpending>(
    recorded.map((r) => [r.accountId, { ...r, planned: 0 }])
  )
  // Like the month's net: what's still planned counts from this month on.
  if (range.end >= today) {
    for (const p of plannedCountedIn(db, range, today)) {
      if (p.group !== 'expense') continue
      const entry = byAccount.get(p.accountId) ?? {
        accountId: p.accountId,
        recorded: 0,
        planned: 0,
        count: 0
      }
      entry.planned += p.amount
      byAccount.set(p.accountId, entry)
    }
  }
  return [...byAccount.values()]
}
