import type { Database } from 'better-sqlite3'
import { formatDate, type IsoDate } from '@shared/dates'
import type { Account } from '@shared/accounts'
import { foldText } from '@shared/text'
import {
  defaultTransferTitle,
  transactionIdSchema,
  transactionInputSchema,
  transactionQuerySchema,
  type DayTotal,
  type Transaction,
  type TransactionInput,
  type TransactionPage,
  type TransactionQuery,
  type EditableType,
  type TransactionType
} from '@shared/transactions'
import { AppError } from '../../errors'
import { getAccount } from './accounts'
import { getCategory } from './categories'
import { getSettings } from './settings'

export interface TransactionRow {
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

export function toTransaction(row: TransactionRow): Transaction {
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

/** The values written to a row by the dialog's create and update. */
export interface RowValues {
  type: EditableType
  title: string
  amount: number
  date: string
  accountId: number
  toAccountId: number | null
  categoryId: number | null
  note: string | null
}

/**
 * An account the transaction may use: not archived (unless the transaction already uses it)
 * and already open on the transaction's date.
 */
function usableAccount(db: Database, id: number, date: string, current?: Transaction): Account {
  const account = getAccount(db, id)
  const alreadyUsed = account.id === current?.accountId || account.id === current?.toAccountId
  if (account.isArchived && !alreadyUsed) {
    throw new AppError('validation', `“${account.name}” is archived. Restore it to use it again.`)
  }
  if (date < account.openingDate) {
    const { locale } = getSettings(db)
    throw new AppError(
      'validation',
      `“${account.name}” starts on ${formatDate(account.openingDate, locale)}. Choose a later date, or move the account’s starting date back first.`
    )
  }
  return account
}

/**
 * Checks the input against the accounts and categories it names and returns the row values.
 * Archived accounts and categories are refused unless the transaction already uses them.
 */
export function checkTransaction(
  db: Database,
  input: TransactionInput,
  current?: Transaction
): RowValues {
  const valid = transactionInputSchema.parse(input)

  // Rows posted from a recurring item or an installment plan settle that item, so they keep
  // their type, and installment payments stay on their card.
  if (current && (current.recurringItemId != null || current.installmentPlanId != null)) {
    if (valid.type !== current.type) {
      throw new AppError(
        'validation',
        `This ${current.type} was posted from a plan, so it stays an ${current.type}.`
      )
    }
    if (current.installmentPlanId != null && valid.accountId !== current.accountId) {
      throw new AppError(
        'validation',
        'Installment payments stay on the card they were bought with.'
      )
    }
  }

  const account = usableAccount(db, valid.accountId, valid.date, current)
  const base = {
    type: valid.type,
    amount: valid.amount,
    date: valid.date,
    accountId: account.id,
    note: valid.note
  }

  if (valid.type === 'transfer') {
    const to = usableAccount(db, valid.toAccountId, valid.date, current)
    return {
      ...base,
      title: valid.title || defaultTransferTitle(account, to),
      toAccountId: to.id,
      categoryId: null
    }
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
  return {
    ...base,
    title: valid.title || category.name,
    toAccountId: null,
    categoryId: category.id
  }
}

const editableTypes: readonly TransactionType[] = ['income', 'expense', 'transfer']

export function createTransaction(db: Database, input: TransactionInput): Transaction {
  const tx = checkTransaction(db, input)
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO transactions (date, title, amount, type, account_id, to_account_id, category_id, note)
       VALUES (@date, @title, @amount, @type, @accountId, @toAccountId, @categoryId, @note)`
    )
    .run(tx)
  return getTransaction(db, Number(lastInsertRowid))
}

/** A transaction that settles a planned occurrence: a recurring item's payment on `plannedDate`. */
export function createPlannedTransaction(
  db: Database,
  input: TransactionInput,
  link: { recurringItemId: number; plannedDate: IsoDate }
): Transaction {
  const tx = checkTransaction(db, input)
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO transactions (date, title, amount, type, account_id, to_account_id, category_id, note,
         recurring_item_id, planned_date)
       VALUES (@date, @title, @amount, @type, @accountId, @toAccountId, @categoryId, @note,
         @recurringItemId, @plannedDate)`
    )
    .run({ ...tx, ...link })
  return getTransaction(db, Number(lastInsertRowid))
}

export function updateTransaction(db: Database, id: number, input: TransactionInput): Transaction {
  const current = getTransaction(db, id)
  if (!editableTypes.includes(current.type)) {
    throw new AppError(
      'validation',
      'Savings and loan movements are edited from their own screens.'
    )
  }
  const tx = checkTransaction(db, input, current)
  db.prepare(
    `UPDATE transactions
     SET date = @date, title = @title, amount = @amount, type = @type, account_id = @accountId,
         to_account_id = @toAccountId, category_id = @categoryId, note = @note
     WHERE id = @id`
  ).run({ ...tx, id })
  return getTransaction(db, id)
}

export function deleteTransaction(db: Database, id: number): void {
  getTransaction(db, id)
  db.prepare('DELETE FROM transactions WHERE id = ?').run(id)
}

const DEFAULT_PAGE_SIZE = 100

/** SQL conditions and parameters for the list filters (paging not included). */
function filterSql(query: ReturnType<typeof transactionQuerySchema.parse>): {
  where: string
  params: Record<string, string | number>
} {
  const conditions: string[] = []
  const params: Record<string, string | number> = {}

  if (query.search) {
    // Case- and accent-insensitive: "cokolada" finds "Čokolada". instr() rather than LIKE,
    // so "%" and "_" in the search are just characters.
    params.needle = foldText(query.search)
    const contains = (column: string): string => `instr(fold(${column}), @needle) > 0`
    const matches = [
      contains('t.title'),
      contains('t.note'),
      `t.category_id IN (SELECT id FROM categories WHERE ${contains('name')})`
    ]
    if (query.amount !== undefined) {
      params.amount = query.amount
      matches.push('t.amount = @amount')
    }
    conditions.push(`(${matches.join(' OR ')})`)
  }
  if (query.from) {
    params.from = query.from
    conditions.push('t.date >= @from')
  }
  if (query.to) {
    params.to = query.to
    conditions.push('t.date <= @to')
  }
  if (query.accountId !== undefined) {
    params.accountId = query.accountId
    conditions.push('(t.account_id = @accountId OR t.to_account_id = @accountId)')
  }
  if (query.categoryId !== undefined) {
    params.categoryId = query.categoryId
    conditions.push('t.category_id = @categoryId')
  }
  if (query.kind) {
    params.kind = query.kind
    conditions.push('t.type = @kind')
  }

  return { where: conditions.length ? conditions.join(' AND ') : '1', params }
}

const totalsSql = /* sql */ `
  coalesce(sum(CASE WHEN t.type = 'income' THEN t.amount END), 0) AS income,
  coalesce(sum(CASE WHEN t.type = 'expense' THEN t.amount END), 0) AS expenses`

/** Newest first, a page at a time, with per-day totals and (on the first page) a summary. */
export function listTransactions(db: Database, input: TransactionQuery = {}): TransactionPage {
  const query = transactionQuerySchema.parse(input)
  const limit = query.limit ?? DEFAULT_PAGE_SIZE
  const { where, params } = filterSql(query)

  const paging = query.after
    ? 'AND (t.date < @afterDate OR (t.date = @afterDate AND t.id < @afterId))'
    : ''
  const rows = db
    .prepare(
      `SELECT t.* FROM transactions t WHERE ${where} ${paging}
       ORDER BY t.date DESC, t.id DESC LIMIT @limit`
    )
    .all({
      ...params,
      ...(query.after && { afterDate: query.after.date, afterId: query.after.id }),
      limit: limit + 1
    }) as TransactionRow[]

  const items = rows.slice(0, limit).map(toTransaction)
  const last = items.at(-1)
  const next = rows.length > limit && last ? { date: last.date, id: last.id } : null

  const days = [...new Set(items.map((t) => t.date))]
  const dayTotals =
    days.length === 0
      ? []
      : (db
          .prepare(
            `SELECT t.date AS date, ${totalsSql} FROM transactions t
             WHERE ${where} AND t.date IN (SELECT value FROM json_each(@days))
             GROUP BY t.date ORDER BY t.date DESC`
          )
          .all({ ...params, days: JSON.stringify(days) }) as DayTotal[])

  const summary = query.after
    ? null
    : (db
        .prepare(`SELECT count(*) AS count, ${totalsSql} FROM transactions t WHERE ${where}`)
        .get(params) as { count: number; income: number; expenses: number })

  return { items, next, dayTotals, summary }
}
