import type { Database } from 'better-sqlite3'
import { eachDay, formatDate, type IsoDate } from '@shared/dates'
import type { BalancePoint } from '@shared/cards'
import { formatMoney } from '@shared/money'
import { isPaletteColor, neutralPaletteColor } from '@shared/palette'
import {
  savingsGoalIdSchema,
  savingsGoalInputSchema,
  savingsMovementInputSchema,
  type SavingsGoal,
  type SavingsGoalInput,
  type SavingsMovementInput
} from '@shared/savings'
import type { Transaction } from '@shared/transactions'
import { AppError } from '../../errors'
import { getAccount } from './accounts'
import { getSettings } from './settings'
import { getTransaction, toTransaction, type TransactionRow } from './transactions'
import { t } from '@shared/i18n'

interface GoalRow {
  id: number
  name: string
  target_amount: number
  target_date: string | null
  starting_amount: number
  planned_monthly: number | null
  color: string | null
  is_archived: number
  sort_order: number
  created_at: string
  saved: number
  movement_count: number
  last_deposit_date: string | null
}

const selectGoals = /* sql */ `
  SELECT g.*,
         g.starting_amount
         + coalesce((SELECT sum(CASE t.type WHEN 'savings_deposit' THEN t.amount ELSE -t.amount END)
                     FROM transactions t WHERE t.savings_goal_id = g.id), 0) AS saved,
         (SELECT count(*) FROM transactions t WHERE t.savings_goal_id = g.id) AS movement_count,
         (SELECT max(t.date) FROM transactions t
          WHERE t.savings_goal_id = g.id AND t.type = 'savings_deposit') AS last_deposit_date
  FROM savings_goals g`

function toGoal(row: GoalRow): SavingsGoal {
  return {
    id: row.id,
    name: row.name,
    targetAmount: row.target_amount,
    targetDate: row.target_date,
    startingAmount: row.starting_amount,
    plannedMonthly: row.planned_monthly,
    color: isPaletteColor(row.color) ? row.color : neutralPaletteColor,
    isArchived: row.is_archived === 1,
    sortOrder: row.sort_order,
    saved: row.saved,
    movementCount: row.movement_count,
    lastDepositDate: row.last_deposit_date,
    createdAt: row.created_at
  }
}

/** Every goal, archived ones included, in the user's order. */
export function listSavingsGoals(db: Database): SavingsGoal[] {
  const rows = db.prepare(`${selectGoals} ORDER BY g.sort_order, g.id`).all() as GoalRow[]
  return rows.map(toGoal)
}

export function getSavingsGoal(db: Database, id: number): SavingsGoal {
  const row = db.prepare(`${selectGoals} WHERE g.id = ?`).get(savingsGoalIdSchema.parse(id)) as
    GoalRow | undefined
  if (!row) throw new AppError('not_found', t('errors.goalGone'))
  return toGoal(row)
}

const columns = (
  goal: ReturnType<typeof savingsGoalInputSchema.parse>
): Record<string, unknown> => ({
  name: goal.name,
  target_amount: goal.targetAmount,
  target_date: goal.targetDate,
  starting_amount: goal.startingAmount,
  planned_monthly: goal.plannedMonthly,
  color: goal.color
})

export function createSavingsGoal(db: Database, input: SavingsGoalInput): SavingsGoal {
  const goal = savingsGoalInputSchema.parse(input)
  const values = columns(goal)
  const names = Object.keys(values)
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO savings_goals (${names.join(', ')}, sort_order)
       VALUES (${names.map((n) => `@${n}`).join(', ')},
               (SELECT coalesce(max(sort_order), 0) + 1 FROM savings_goals))`
    )
    .run(values)
  return getSavingsGoal(db, Number(lastInsertRowid))
}

export function updateSavingsGoal(db: Database, id: number, input: SavingsGoalInput): SavingsGoal {
  const current = getSavingsGoal(db, id)
  const goal = savingsGoalInputSchema.parse(input)
  // Lowering the starting amount can't take more out than has been saved.
  const saved = current.saved - current.startingAmount + goal.startingAmount
  if (saved < 0) {
    throw new AppError('validation', t('errors.goalStartTooLow'))
  }
  const values = columns(goal)
  db.prepare(
    `UPDATE savings_goals SET ${Object.keys(values)
      .map((n) => `${n} = @${n}`)
      .join(', ')} WHERE id = @id`
  ).run({ ...values, id })
  return getSavingsGoal(db, id)
}

export function setSavingsGoalArchived(db: Database, id: number, archived: boolean): SavingsGoal {
  getSavingsGoal(db, id)
  db.prepare('UPDATE savings_goals SET is_archived = ? WHERE id = ?').run(Number(archived), id)
  return getSavingsGoal(db, id)
}

/** Only goals without deposits or withdrawals can be deleted; others are archived. */
export function deleteSavingsGoal(db: Database, id: number): void {
  const goal = getSavingsGoal(db, id)
  if (goal.movementCount > 0) {
    throw new AppError('conflict', t('errors.goalInUse', { name: goal.name }))
  }
  db.prepare('DELETE FROM savings_goals WHERE id = ?').run(id)
}

const typeFor = { deposit: 'savings_deposit', withdrawal: 'savings_withdrawal' } as const

/** Checks a movement against its goal and account; `current` is the one being edited. */
function checkMovement(
  db: Database,
  input: SavingsMovementInput,
  current?: Transaction
): ReturnType<typeof savingsMovementInputSchema.parse> {
  const movement = savingsMovementInputSchema.parse(input)
  const goal = getSavingsGoal(db, movement.goalId)
  if (goal.isArchived && current?.savingsGoalId !== goal.id) {
    throw new AppError('validation', t('errors.goalArchived', { name: goal.name }))
  }
  const account = getAccount(db, movement.accountId)
  if (account.isArchived && account.id !== current?.accountId) {
    throw new AppError('validation', t('errors.archived', { name: account.name }))
  }
  const { locale, currency } = getSettings(db)
  if (movement.date < account.openingDate) {
    throw new AppError(
      'validation',
      t('recurring.accountStarts', {
        account: account.name,
        date: formatDate(account.openingDate, locale)
      })
    )
  }

  // The goal can't go below zero: what it would hold without this movement, plus it.
  const without =
    current?.savingsGoalId === goal.id
      ? goal.saved - (current.type === 'savings_deposit' ? current.amount : -current.amount)
      : goal.saved
  const after = without + (movement.type === 'deposit' ? movement.amount : -movement.amount)
  if (after < 0) {
    throw new AppError(
      'validation',
      t('errors.goalOnlyHas', {
        name: goal.name,
        amount: formatMoney(Math.max(0, without), { currency, locale })
      })
    )
  }
  return movement
}

/** Puts money into a goal from an account, or takes it back out into one. */
export function addSavingsMovement(db: Database, input: SavingsMovementInput): Transaction {
  const movement = checkMovement(db, input)
  const goal = getSavingsGoal(db, movement.goalId)
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO transactions (date, title, amount, type, account_id, savings_goal_id, note)
       VALUES (@date, @title, @amount, @type, @accountId, @goalId, @note)`
    )
    .run({ ...movement, type: typeFor[movement.type], title: goal.name })
  return getTransaction(db, Number(lastInsertRowid))
}

function getMovement(db: Database, id: number): Transaction {
  const tx = getTransaction(db, id)
  if (tx.savingsGoalId === null) {
    throw new AppError('validation', t('errors.notSavingsMovement'))
  }
  return tx
}

export function updateSavingsMovement(
  db: Database,
  id: number,
  input: SavingsMovementInput
): Transaction {
  const current = getMovement(db, id)
  const movement = checkMovement(db, input, current)
  const goal = getSavingsGoal(db, movement.goalId)
  db.prepare(
    `UPDATE transactions SET date = @date, amount = @amount, type = @type, account_id = @accountId,
       savings_goal_id = @goalId, note = @note,
       title = CASE WHEN savings_goal_id = @goalId THEN title ELSE @title END,
       -- A monthly summary moved to another goal or month becomes an ordinary movement there.
       is_month_total = is_month_total AND type = @type AND savings_goal_id = @goalId
         AND substr(date, 1, 7) = substr(@date, 1, 7)
     WHERE id = @id`
  ).run({ ...movement, type: typeFor[movement.type], title: goal.name, id })
  return getTransaction(db, id)
}

/** Deletes a deposit or withdrawal, unless the goal would then hold less than nothing. */
export function deleteSavingsMovement(db: Database, id: number): void {
  const tx = getMovement(db, id)
  const goal = getSavingsGoal(db, tx.savingsGoalId as number)
  if (tx.type === 'savings_deposit' && goal.saved - tx.amount < 0) {
    const { locale, currency } = getSettings(db)
    throw new AppError(
      'validation',
      t('errors.goalBelowZero', {
        name: goal.name,
        amount: formatMoney(tx.amount, { currency, locale })
      })
    )
  }
  db.prepare('DELETE FROM transactions WHERE id = ?').run(id)
}

/** A goal's deposits and withdrawals, newest first. */
export function listSavingsMovements(db: Database, goalId: number): Transaction[] {
  const rows = db
    .prepare('SELECT * FROM transactions WHERE savings_goal_id = ? ORDER BY date DESC, id DESC')
    .all(savingsGoalIdSchema.parse(goalId)) as TransactionRow[]
  return rows.map(toTransaction)
}

/**
 * What the goal held at the end of each day, from its first deposit or withdrawal (or its
 * creation) to `today`. The starting amount counts from the first day.
 */
export function getSavingsSeries(db: Database, goalId: number, today: IsoDate): BalancePoint[] {
  const goal = getSavingsGoal(db, goalId)
  const changes = db
    .prepare(
      `SELECT date, sum(CASE type WHEN 'savings_deposit' THEN amount ELSE -amount END) AS delta
       FROM transactions WHERE savings_goal_id = ? AND date <= ? GROUP BY date ORDER BY date`
    )
    .all(goalId, today) as { date: IsoDate; delta: number }[]
  // Movements can be dated before the goal was created in the app (catching up on the past).
  const created = goal.createdAt.slice(0, 10)
  const first = changes[0] && changes[0].date < created ? changes[0].date : created
  const from = first < today ? first : today

  let saved = goal.startingAmount
  let next = 0
  return eachDay(from, today).map((date) => {
    while (next < changes.length && changes[next].date <= date) saved += changes[next++].delta
    return { date, balance: saved }
  })
}
