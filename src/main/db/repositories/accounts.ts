import type { Database } from 'better-sqlite3'
import {
  accountIdSchema,
  accountInputSchema,
  type Account,
  type AccountInput,
  type AccountType
} from '@shared/accounts'
import { today, type IsoDate } from '@shared/dates'
import { isPaletteColor, neutralPaletteColor } from '@shared/palette'
import { AppError } from '../../errors'
import { signedAmountSql } from '../ledger'

interface AccountRow {
  id: number
  name: string
  type: AccountType
  opening_balance: number
  opening_date: string
  credit_limit: number | null
  statement_day: number | null
  payment_due_day: number | null
  color: string | null
  is_archived: number
  sort_order: number
  balance: number
  usage_count: number
}

/** Rows that point at an account, by table and column. */
const references = [
  ['transactions', 'account_id'],
  ['transactions', 'to_account_id'],
  ['recurring_items', 'account_id'],
  ['loans', 'account_id'],
  ['installment_plans', 'account_id']
] as const

/**
 * Balance as of `@asOf`: the opening balance plus transactions dated from the opening date
 * to `@asOf`. Earlier transactions are history the opening balance already includes.
 */
const selectAccounts = /* sql */ `
  SELECT a.*,
         a.opening_balance
         + coalesce((SELECT sum(${signedAmountSql('t')}) FROM transactions t
                     WHERE t.account_id = a.id AND t.date BETWEEN a.opening_date AND @asOf), 0)
         + coalesce((SELECT sum(t.amount) FROM transactions t
                     WHERE t.to_account_id = a.id AND t.date BETWEEN a.opening_date AND @asOf), 0)
           AS balance,
         ${references
           .map(([table, column]) => `(SELECT count(*) FROM ${table} r WHERE r.${column} = a.id)`)
           .join(' + ')} AS usage_count
  FROM accounts a`

function toAccount(row: AccountRow): Account {
  const isCredit = row.type === 'credit'
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    openingBalance: row.opening_balance,
    openingDate: row.opening_date,
    creditLimit: row.credit_limit,
    statementDay: row.statement_day,
    paymentDueDay: row.payment_due_day,
    color: isPaletteColor(row.color) ? row.color : neutralPaletteColor,
    isArchived: row.is_archived === 1,
    sortOrder: row.sort_order,
    balance: row.balance,
    available: isCredit ? (row.credit_limit ?? 0) + row.balance : null,
    usageCount: row.usage_count
  }
}

/** All accounts, archived ones included, in the user's order. */
export function listAccounts(db: Database, asOf: IsoDate = today()): Account[] {
  const rows = db
    .prepare(`${selectAccounts} ORDER BY a.sort_order, a.id`)
    .all({ asOf }) as AccountRow[]
  return rows.map(toAccount)
}

export function getAccount(db: Database, id: number, asOf: IsoDate = today()): Account {
  const row = db
    .prepare(`${selectAccounts} WHERE a.id = @id`)
    .get({ id: accountIdSchema.parse(id), asOf }) as AccountRow | undefined
  if (!row) throw new AppError('not_found', 'That account no longer exists.')
  return toAccount(row)
}

function assertNameFree(db: Database, name: string, exceptId?: number): void {
  const clash = db
    .prepare('SELECT 1 FROM accounts WHERE name = ? COLLATE NOCASE AND id IS NOT ?')
    .get(name, exceptId ?? null)
  if (clash) throw new AppError('conflict', `You already have an account called “${name}”.`)
}

/** Column values for an input; credit-card columns are NULL for other types. */
function toColumns(input: AccountInput): Record<string, string | number | null> {
  const credit = input.type === 'credit' ? input : null
  return {
    name: input.name,
    type: input.type,
    opening_balance: input.openingBalance,
    opening_date: input.openingDate,
    credit_limit: credit?.creditLimit ?? null,
    statement_day: credit?.statementDay ?? null,
    payment_due_day: credit?.paymentDueDay ?? null,
    color: input.color
  }
}

export function createAccount(db: Database, input: AccountInput): Account {
  const valid = accountInputSchema.parse(input)
  assertNameFree(db, valid.name)
  const columns = toColumns(valid)
  const names = Object.keys(columns)
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO accounts (${names.join(', ')}, sort_order)
       VALUES (${names.map((n) => `@${n}`).join(', ')},
               (SELECT coalesce(max(sort_order), 0) + 1 FROM accounts))`
    )
    .run(columns)
  return getAccount(db, Number(lastInsertRowid))
}

export function updateAccount(db: Database, id: number, input: AccountInput): Account {
  const valid = accountInputSchema.parse(input)
  const current = getAccount(db, id)
  assertNameFree(db, valid.name, current.id)

  if (current.type === 'credit' && valid.type !== 'credit') {
    const plans = db
      .prepare('SELECT count(*) AS n FROM installment_plans WHERE account_id = ?')
      .get(id) as { n: number }
    if (plans.n > 0) {
      throw new AppError(
        'validation',
        `“${current.name}” has purchases paid in installments, so it has to stay a credit card.`
      )
    }
  }

  const columns = toColumns(valid)
  db.prepare(
    `UPDATE accounts SET ${Object.keys(columns)
      .map((n) => `${n} = @${n}`)
      .join(', ')} WHERE id = @id`
  ).run({ ...columns, id })
  return getAccount(db, id)
}

export function setAccountArchived(db: Database, id: number, archived: boolean): Account {
  getAccount(db, id)
  db.prepare('UPDATE accounts SET is_archived = ? WHERE id = ?').run(Number(archived), id)
  return getAccount(db, id)
}

/** Only accounts nothing refers to can be deleted; others are archived. */
export function deleteAccount(db: Database, id: number): void {
  const account = getAccount(db, id)
  if (account.usageCount > 0) {
    throw new AppError(
      'conflict',
      `“${account.name}” has transactions or plans linked to it. Archive it instead to keep your history.`
    )
  }
  db.prepare('DELETE FROM accounts WHERE id = ?').run(id)
}
