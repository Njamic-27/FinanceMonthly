import type { Database } from 'better-sqlite3'
import {
  ADJUSTMENT_TITLE,
  adjustmentUpdateSchema,
  balanceTargetsSchema,
  isAdjustment,
  type AdjustmentUpdate,
  type BalanceTarget
} from '@shared/adjustments'
import { formatDate, type IsoDate } from '@shared/dates'
import { transactionIdSchema, type Transaction } from '@shared/transactions'
import { AppError } from '../../errors'
import { getAccount } from './accounts'
import { getSettings } from './settings'
import { getTransaction, usableAccount } from './transactions'

// Balance adjustments (PLAN.md §2, step 39): the difference between an account's balance in the
// app and the real one, as a transaction in or out of the account. Not income or spending.

const typeFor = (difference: number): 'adjustment_in' | 'adjustment_out' =>
  difference > 0 ? 'adjustment_in' : 'adjustment_out'

/**
 * Sets accounts to the balances you typed: for each one that differs today, an adjustment for
 * the difference, dated today. Returns the adjustments added (none for balances that match).
 */
export function adjustBalances(
  db: Database,
  targets: BalanceTarget[],
  today: IsoDate
): Transaction[] {
  const valid = balanceTargetsSchema.parse(targets)
  return db.transaction(() =>
    valid.flatMap(({ accountId, balance }) => {
      const account = getAccount(db, accountId, today)
      if (account.isArchived) {
        throw new AppError(
          'validation',
          `“${account.name}” is archived. Restore it to correct its balance.`
        )
      }
      if (today < account.openingDate) {
        const { locale } = getSettings(db)
        throw new AppError(
          'validation',
          `“${account.name}” starts on ${formatDate(account.openingDate, locale)}. Change its starting balance instead.`
        )
      }
      const difference = balance - account.balance
      if (difference === 0) return []
      const { lastInsertRowid } = db
        .prepare(
          `INSERT INTO transactions (date, title, amount, type, account_id)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(today, ADJUSTMENT_TITLE, Math.abs(difference), typeFor(difference), account.id)
      return [getTransaction(db, Number(lastInsertRowid))]
    })
  )()
}

/** Changes an adjustment's amount (+ in, − out), date or note. */
export function updateAdjustment(db: Database, id: number, input: AdjustmentUpdate): Transaction {
  const current = getTransaction(db, transactionIdSchema.parse(id))
  if (!isAdjustment(current.type)) {
    throw new AppError('validation', 'That transaction isn’t a balance adjustment.')
  }
  const valid = adjustmentUpdateSchema.parse(input)
  usableAccount(db, current.accountId, valid.date, current)
  db.prepare(
    `UPDATE transactions SET amount = @amount, type = @type, date = @date, note = @note
     WHERE id = @id`
  ).run({
    id,
    amount: Math.abs(valid.amount),
    type: typeFor(valid.amount),
    date: valid.date,
    note: valid.note
  })
  return getTransaction(db, id)
}
