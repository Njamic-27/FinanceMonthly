import type { Database } from 'better-sqlite3'
import type { Category, CategoryType } from '@shared/categories'
import { fallbackCategoryIcon } from '@shared/categories'
import type { IsoDate } from '@shared/dates'
import {
  monthLineInputSchema,
  monthRowHideSchema,
  monthRowOrderSchema,
  monthRowRenameSchema,
  type MonthLineInput,
  type MonthRowHide,
  type MonthRowKind,
  type MonthRowOrder,
  type MonthRowRename
} from '@shared/month'
import { nextPaletteColor } from '@shared/palette'
import { AppError } from '../errors'
import {
  createCategory,
  getCategory,
  listCategories,
  updateCategory
} from '../db/repositories/categories'
import {
  addMonthRow,
  listMonthRows,
  setMonthRowAccount,
  setMonthRowHidden,
  setMonthRowOrder
} from '../db/repositories/monthRows'
import { createRecurringItem, getRecurringItem } from '../db/repositories/recurring'
import { getSavingsGoal } from '../db/repositories/savings'
import { categoryRowAccount, monthSheet, setMonthCell } from './monthSheet'

// Changing the Month sheet's rows (PLAN.md §3, Month): "+" under a section, rename, hide and
// reorder. Only categories are stored as rows; the other rows come from their own items.

/** The category called `name` (ignoring case), restored if archived, or a new one. */
function categoryByName(db: Database, type: CategoryType, name: string): Category {
  const categories = listCategories(db).filter((c) => c.type === type)
  const existing = categories.find((c) => c.name.toLowerCase() === name.toLowerCase())
  if (existing) {
    return existing.isArchived ? updateCategory(db, existing.id, { isArchived: false }) : existing
  }
  return createCategory(db, {
    name,
    type,
    color: nextPaletteColor(categories.filter((c) => !c.isArchived).map((c) => c.color)),
    icon: fallbackCategoryIcon
  })
}

/** Makes sure a category is on the sheet, using `accountId` (else the account it'd use). */
function ensureRow(db: Database, categoryId: number, today: IsoDate, accountId?: number): void {
  if (listMonthRows(db).some((r) => r.categoryId === categoryId)) {
    if (accountId !== undefined) setMonthRowAccount(db, { categoryId, accountId })
    return
  }
  const account = accountId ?? categoryRowAccount(db, categoryId, today)
  if (account === null) throw new AppError('validation', 'Add an account first.')
  addMonthRow(db, { categoryId, accountId: account })
}

/**
 * "+" under Income or Expenses. Adds the category to the sheet (shown again if it was hidden)
 * with this month's amount, or with "Every month" a monthly recurring item. Returns the row.
 */
export function addMonthLine(
  db: Database,
  input: MonthLineInput,
  today: IsoDate
): { kind: MonthRowKind; sourceId: number } {
  const line = monthLineInputSchema.parse(input)
  monthSheet(db, { month: line.month }, today) // checks the month is in reach
  return db.transaction(() => {
    const category = categoryByName(db, line.type, line.name)
    if (line.everyMonth) {
      const first = line.date as IsoDate
      const item = createRecurringItem(db, {
        kind: line.type,
        title: line.name,
        amount: line.amount,
        accountId: line.accountId,
        categoryId: category.id,
        frequency: 'monthly',
        interval: 1,
        anchorDate: first,
        nextDueDate: first,
        autoPost: false,
        reminderDaysBefore: null
      })
      return { kind: 'recurring' as const, sourceId: item.id }
    }
    ensureRow(db, category.id, today, line.accountId)
    setMonthRowHidden(db, category.id, false)
    if (line.amount > 0) {
      setMonthCell(
        db,
        {
          month: line.month,
          kind: 'category',
          sourceId: category.id,
          amount: line.amount,
          accountId: line.accountId
        },
        today
      )
    }
    return { kind: 'category' as const, sourceId: category.id }
  })()
}

/** Renames a category, recurring item or savings goal from its row. */
export function renameMonthRow(db: Database, input: MonthRowRename): void {
  const { kind, sourceId, name } = monthRowRenameSchema.parse(input)
  if (kind === 'category') {
    updateCategory(db, sourceId, { name })
  } else if (kind === 'recurring') {
    getRecurringItem(db, sourceId)
    db.prepare('UPDATE recurring_items SET title = ? WHERE id = ?').run(name, sourceId)
  } else {
    getSavingsGoal(db, sourceId)
    db.prepare('UPDATE savings_goals SET name = ? WHERE id = ?').run(name, sourceId)
  }
}

/** Hides a category's row from months without its transactions, or shows it again. */
export function hideMonthRow(db: Database, input: MonthRowHide, today: IsoDate): void {
  const { categoryId, hidden } = monthRowHideSchema.parse(input)
  getCategory(db, categoryId)
  db.transaction(() => {
    ensureRow(db, categoryId, today)
    setMonthRowHidden(db, categoryId, hidden)
  })()
}

/** Puts a section's category rows in a new order, adding any shown but not yet added. */
export function reorderMonthRows(db: Database, input: MonthRowOrder, today: IsoDate): void {
  const { type, categoryIds } = monthRowOrderSchema.parse(input)
  db.transaction(() => {
    for (const categoryId of categoryIds) {
      if (getCategory(db, categoryId).type !== type) {
        throw new AppError('validation', 'Rows can only move within their own section.')
      }
      ensureRow(db, categoryId, today)
    }
    setMonthRowOrder(db, type, categoryIds)
  })()
}
