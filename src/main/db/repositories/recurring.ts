import type { Database } from 'better-sqlite3'
import {
  postedType,
  recurringIdSchema,
  recurringItemInputSchema,
  type Frequency,
  type RecurringItem,
  type RecurringItemInput,
  type RecurringKind
} from '@shared/recurring'
import { AppError } from '../../errors'
import { getAccount } from './accounts'
import { getCategory } from './categories'
import { t } from '@shared/i18n'

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
  posted_count: number
}

const selectItems = /* sql */ `
  SELECT r.*,
         (SELECT count(*) FROM transactions t WHERE t.recurring_item_id = r.id) AS posted_count
  FROM recurring_items r`

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
    isActive: row.is_active === 1,
    postedCount: row.posted_count
  }
}

export function listRecurringItems(db: Database): RecurringItem[] {
  const rows = db.prepare(`${selectItems} ORDER BY r.next_due_date, r.id`).all() as RecurringRow[]
  return rows.map(toRecurringItem)
}

export function getRecurringItem(db: Database, id: number): RecurringItem {
  const row = db.prepare(`${selectItems} WHERE r.id = ?`).get(recurringIdSchema.parse(id)) as
    RecurringRow | undefined
  if (!row) throw new AppError('not_found', t('errors.recurringGone'))
  return toRecurringItem(row)
}

/**
 * Validates the input and the account and category it names. Archived ones are refused
 * unless the item already uses them.
 */
function check(
  db: Database,
  input: RecurringItemInput,
  current?: RecurringItem
): ReturnType<typeof recurringItemInputSchema.parse> {
  const item = recurringItemInputSchema.parse(input)

  const account = getAccount(db, item.accountId)
  if (account.isArchived && account.id !== current?.accountId) {
    throw new AppError('validation', t('errors.archived', { name: account.name }))
  }
  const category = getCategory(db, item.categoryId)
  const categoryType = postedType(item.kind)
  if (
    category.type !== categoryType ||
    (category.isArchived && category.id !== current?.categoryId)
  ) {
    throw new AppError(
      'validation',
      t(categoryType === 'income' ? 'errors.incomeCategoryActive' : 'errors.expenseCategoryActive')
    )
  }
  // Posted transactions keep their type, so an item can't switch between income and spending.
  if (current && current.postedCount > 0 && postedType(current.kind) !== categoryType) {
    throw new AppError(
      'validation',
      current.kind === 'income' ? t('errors.staysIncome') : t('errors.staysExpense')
    )
  }
  return item
}

export function createRecurringItem(db: Database, input: RecurringItemInput): RecurringItem {
  const item = check(db, input)
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO recurring_items (kind, title, amount, account_id, category_id, frequency, interval,
         anchor_date, end_date, next_due_date, auto_post, reminder_days_before, url, note)
       VALUES (@kind, @title, @amount, @accountId, @categoryId, @frequency, @interval,
         @anchorDate, @endDate, @nextDueDate, @autoPost, @reminderDaysBefore, @url, @note)`
    )
    .run({ ...item, autoPost: Number(item.autoPost) })
  return getRecurringItem(db, Number(lastInsertRowid))
}

/**
 * Replaces an item's details and schedule. Transactions it already posted stay as they are;
 * the new schedule applies from `nextDueDate` on.
 */
export function updateRecurringItem(
  db: Database,
  id: number,
  input: RecurringItemInput
): RecurringItem {
  const current = getRecurringItem(db, id)
  const item = check(db, input, current)
  db.prepare(
    `UPDATE recurring_items
     SET kind = @kind, title = @title, amount = @amount, account_id = @accountId,
         category_id = @categoryId, frequency = @frequency, interval = @interval,
         anchor_date = @anchorDate, end_date = @endDate, next_due_date = @nextDueDate,
         auto_post = @autoPost, reminder_days_before = @reminderDaysBefore, url = @url,
         note = @note
     WHERE id = @id`
  ).run({ ...item, autoPost: Number(item.autoPost), id })
  return getRecurringItem(db, id)
}

/** Deletes the item. Transactions it posted stay, as ordinary transactions. */
export function deleteRecurringItem(db: Database, id: number): void {
  getRecurringItem(db, id)
  db.transaction(() => {
    // A planned date only means something while the item exists (and the schema requires one).
    db.prepare(
      'UPDATE transactions SET recurring_item_id = NULL, planned_date = NULL WHERE recurring_item_id = ?'
    ).run(id)
    db.prepare(
      "DELETE FROM notification_log WHERE source_type = 'recurring' AND source_id = ?"
    ).run(id)
    db.prepare('DELETE FROM recurring_items WHERE id = ?').run(id)
  })()
}

/** Moves the item's next due date; the posting service is the only caller. */
export function setNextDueDate(db: Database, id: number, nextDueDate: string): void {
  db.prepare('UPDATE recurring_items SET next_due_date = ? WHERE id = ?').run(nextDueDate, id)
}

/** Pauses or resumes the item; the posting service is the only caller. */
export function setActive(db: Database, id: number, active: boolean): void {
  db.prepare('UPDATE recurring_items SET is_active = ? WHERE id = ?').run(Number(active), id)
}

/** Sets the last day it can fall due; the posting service is the only caller. */
export function setEndDate(db: Database, id: number, endDate: string): void {
  db.prepare('UPDATE recurring_items SET end_date = ? WHERE id = ?').run(endDate, id)
}
