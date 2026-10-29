import type { Database } from 'better-sqlite3'
import type { CategoryType } from '@shared/categories'
import { AppError } from '../../errors'
import { getAccount } from './accounts'
import { getCategory } from './categories'

/** A category added to the Month sheet (PLAN.md §2, month_rows). */
export interface MonthRow {
  id: number
  section: CategoryType
  categoryId: number
  /** The account its new summaries use; null once that account is deleted. */
  defaultAccountId: number | null
  sortOrder: number
  isHidden: boolean
}

interface MonthRowRow {
  id: number
  section: CategoryType
  category_id: number
  default_account_id: number | null
  sort_order: number
  is_hidden: number
}

const toMonthRow = (row: MonthRowRow): MonthRow => ({
  id: row.id,
  section: row.section,
  categoryId: row.category_id,
  defaultAccountId: row.default_account_id,
  sortOrder: row.sort_order,
  isHidden: row.is_hidden === 1
})

/** Every row, hidden ones included, in the user's order. */
export function listMonthRows(db: Database): MonthRow[] {
  const rows = db
    .prepare('SELECT * FROM month_rows ORDER BY section DESC, sort_order, id')
    .all() as MonthRowRow[]
  return rows.map(toMonthRow)
}

/** Adds a category to the sheet, last in its section, with the account its summaries use. */
export function addMonthRow(
  db: Database,
  input: { categoryId: number; accountId: number }
): MonthRow {
  const category = getCategory(db, input.categoryId)
  const account = getAccount(db, input.accountId)
  if (account.isArchived) {
    throw new AppError('validation', `“${account.name}” is archived. Restore it to use it again.`)
  }
  if (db.prepare('SELECT 1 FROM month_rows WHERE category_id = ?').get(category.id)) {
    throw new AppError('conflict', `“${category.name}” is on the sheet already.`)
  }
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO month_rows (section, category_id, default_account_id, sort_order)
       VALUES (@section, @categoryId, @accountId,
               (SELECT coalesce(max(sort_order), 0) + 1 FROM month_rows WHERE section = @section))`
    )
    .run({ section: category.type, categoryId: category.id, accountId: account.id })
  const row = db
    .prepare('SELECT * FROM month_rows WHERE id = ?')
    .get(lastInsertRowid) as MonthRowRow
  return toMonthRow(row)
}

/** Sets the account a category's summaries use, adding the category to the sheet if needed. */
export function setMonthRowAccount(
  db: Database,
  input: { categoryId: number; accountId: number }
): MonthRow {
  const updated = db
    .prepare('UPDATE month_rows SET default_account_id = ? WHERE category_id = ?')
    .run(input.accountId, input.categoryId)
  if (updated.changes === 0) return addMonthRow(db, input)
  const row = db
    .prepare('SELECT * FROM month_rows WHERE category_id = ?')
    .get(input.categoryId) as MonthRowRow
  return toMonthRow(row)
}

export function setMonthRowHidden(db: Database, categoryId: number, hidden: boolean): void {
  db.prepare('UPDATE month_rows SET is_hidden = ? WHERE category_id = ?').run(
    hidden ? 1 : 0,
    categoryId
  )
}

/** Puts a section's rows in this order; rows left out follow, in the order they had. */
export function setMonthRowOrder(db: Database, section: CategoryType, categoryIds: number[]): void {
  const rest = listMonthRows(db)
    .filter((r) => r.section === section && !categoryIds.includes(r.categoryId))
    .map((r) => r.categoryId)
  const update = db.prepare('UPDATE month_rows SET sort_order = ? WHERE category_id = ?')
  ;[...categoryIds, ...rest].forEach((categoryId, i) => update.run(i + 1, categoryId))
}
