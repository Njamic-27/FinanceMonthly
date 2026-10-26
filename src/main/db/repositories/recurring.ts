import type { Database } from 'better-sqlite3'
import {
  recurringItemInputSchema,
  type Frequency,
  type RecurringItem,
  type RecurringItemInput,
  type RecurringKind
} from '@shared/recurring'
import { AppError } from '../../errors'
import { getAccount } from './accounts'
import { getCategory } from './categories'

interface RecurringRow {
  id: number
  kind: RecurringKind
  title: string
  amount: number
  account_id: number
  category_id: number
  frequency: Frequency
  interval: number
  anchor_date: string
  end_date: string | null
  next_due_date: string
  auto_post: number
  reminder_days_before: number | null
  url: string | null
  note: string | null
  is_active: number
}

function toRecurringItem(row: RecurringRow): RecurringItem {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    amount: row.amount,
    accountId: row.account_id,
    categoryId: row.category_id,
    frequency: row.frequency,
    interval: row.interval,
    anchorDate: row.anchor_date,
    endDate: row.end_date,
    nextDueDate: row.next_due_date,
    autoPost: row.auto_post === 1,
    reminderDaysBefore: row.reminder_days_before,
    url: row.url,
    note: row.note,
    isActive: row.is_active === 1
  }
}

export function listRecurringItems(db: Database): RecurringItem[] {
  const rows = db
    .prepare('SELECT * FROM recurring_items ORDER BY next_due_date, id')
    .all() as RecurringRow[]
  return rows.map(toRecurringItem)
}

export function getRecurringItem(db: Database, id: number): RecurringItem {
  const row = db.prepare('SELECT * FROM recurring_items WHERE id = ?').get(id) as
    RecurringRow | undefined
  if (!row) throw new AppError('not_found', 'That recurring item no longer exists.')
  return toRecurringItem(row)
}

export function createRecurringItem(db: Database, input: RecurringItemInput): RecurringItem {
  const item = recurringItemInputSchema.parse(input)

  const account = getAccount(db, item.accountId)
  if (account.isArchived) {
    throw new AppError('validation', `“${account.name}” is archived. Restore it to use it again.`)
  }
  const category = getCategory(db, item.categoryId)
  const categoryType = item.kind === 'income' ? 'income' : 'expense'
  if (category.type !== categoryType || category.isArchived) {
    throw new AppError('validation', `Choose an ${categoryType} category that isn’t archived.`)
  }

  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO recurring_items (kind, title, amount, account_id, category_id, frequency, interval,
         anchor_date, next_due_date, auto_post, reminder_days_before)
       VALUES (@kind, @title, @amount, @accountId, @categoryId, @frequency, @interval,
         @anchorDate, @nextDueDate, @autoPost, @reminderDaysBefore)`
    )
    .run({ ...item, autoPost: Number(item.autoPost) })
  return getRecurringItem(db, Number(lastInsertRowid))
}
