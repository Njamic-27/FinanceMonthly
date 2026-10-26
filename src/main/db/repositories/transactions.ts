import type { Database } from 'better-sqlite3'
import { formatDate } from '@shared/dates'
import {
  transactionIdSchema,
  transactionInputSchema,
  type Transaction,
  type TransactionInput,
  type TransactionType
} from '@shared/transactions'
import { AppError } from '../../errors'
import { getAccount } from './accounts'
import { getCategory } from './categories'
import { getSettings } from './settings'

interface TransactionRow {
  id: number
  date: string
  title: string
  amount: number
  type: TransactionType
  account_id: number
  to_account_id: number | null
  category_id: number | null
  recurring_item_id: number | null
  savings_goal_id: number | null
  loan_id: number | null
  loan_installment_id: number | null
  installment_plan_id: number | null
  planned_date: string | null
  note: string | null
  created_at: string
  updated_at: string
}

function toTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    date: row.date,
    title: row.title,
    amount: row.amount,
    type: row.type,
    accountId: row.account_id,
    toAccountId: row.to_account_id,
    categoryId: row.category_id,
    recurringItemId: row.recurring_item_id,
    savingsGoalId: row.savings_goal_id,
    loanId: row.loan_id,
    loanInstallmentId: row.loan_installment_id,
    installmentPlanId: row.installment_plan_id,
    plannedDate: row.planned_date,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function getTransaction(db: Database, id: number): Transaction {
  const row = db
    .prepare('SELECT * FROM transactions WHERE id = ?')
    .get(transactionIdSchema.parse(id)) as TransactionRow | undefined
  if (!row) throw new AppError('not_found', 'That transaction no longer exists.')
  return toTransaction(row)
}

/**
 * Checks the input against the accounts and categories it names and returns the row values.
 * Archived accounts and categories are refused unless the transaction already uses them.
 */
function resolve(
  db: Database,
  input: TransactionInput,
  current?: Transaction
): { title: string; note: string | null } & Omit<TransactionInput, 'title' | 'note'> {
  const valid = transactionInputSchema.parse(input)

  const account = getAccount(db, valid.accountId)
  if (account.isArchived && account.id !== current?.accountId) {
    throw new AppError('validation', `“${account.name}” is archived. Restore it to use it again.`)
  }
  if (valid.date < account.openingDate) {
    const { locale } = getSettings(db)
    throw new AppError(
      'validation',
      `“${account.name}” starts on ${formatDate(account.openingDate, locale)}. Choose a later date, or move the account’s starting date back first.`
    )
  }
  if (current?.installmentPlanId != null && account.id !== current.accountId) {
    throw new AppError('validation', 'Installment payments stay on the card they were bought with.')
  }

  const category = getCategory(db, valid.categoryId)
  if (category.type !== valid.type) {
    throw new AppError(
      'validation',
      `“${category.name}” is an ${category.type} category. Choose an ${valid.type} category.`
    )
  }
  if (category.isArchived && category.id !== current?.categoryId) {
    throw new AppError('validation', `“${category.name}” is archived. Restore it to use it again.`)
  }

  return { ...valid, title: valid.title || category.name }
}

export function createTransaction(db: Database, input: TransactionInput): Transaction {
  const tx = resolve(db, input)
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO transactions (date, title, amount, type, account_id, category_id, note)
       VALUES (@date, @title, @amount, @type, @accountId, @categoryId, @note)`
    )
    .run(tx)
  return getTransaction(db, Number(lastInsertRowid))
}

export function updateTransaction(db: Database, id: number, input: TransactionInput): Transaction {
  const current = getTransaction(db, id)
  if (current.type !== 'income' && current.type !== 'expense') {
    throw new AppError('validation', 'Only income and expenses can be edited here.')
  }
  const tx = resolve(db, input, current)
  db.prepare(
    `UPDATE transactions
     SET date = @date, title = @title, amount = @amount, type = @type,
         account_id = @accountId, category_id = @categoryId, note = @note
     WHERE id = @id`
  ).run({ ...tx, id })
  return getTransaction(db, id)
}

export function deleteTransaction(db: Database, id: number): void {
  getTransaction(db, id)
  db.prepare('DELETE FROM transactions WHERE id = ?').run(id)
}
