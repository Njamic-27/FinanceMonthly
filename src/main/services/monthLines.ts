import type { Database } from 'better-sqlite3'
import type { Category, CategoryType, ExpenseGroup } from '@shared/categories'
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
import { createInstallmentPlan } from '../db/repositories/installments'
import { createRecurringItem, getRecurringItem } from '../db/repositories/recurring'
import { getSavingsGoal } from '../db/repositories/savings'
import { createTransaction } from '../db/repositories/transactions'
import { categoryRowAccount, monthSheet } from './monthSheet'
import { postDueInstallments } from './posting'

// Changing the Month sheet's rows (PLAN.md §3, Month): "+" under a section, rename, hide and
// reorder. Only categories are stored as rows; the other rows come from their own items.

/**
 * The category called `name` (ignoring case), restored if archived, or a new one (an expense
 * one in `group`).
 */
function categoryByName(
  db: Database,
  type: CategoryType,
  name: string,
  group?: ExpenseGroup
): Category {
  const categories = listCategories(db).filter((c) => c.type === type)
  const existing = categories.find((c) => c.name.toLowerCase() === name.toLowerCase())
  if (existing) {
    return existing.isArchived ? updateCategory(db, existing.id, { isArchived: false }) : existing
  }
  return createCategory(db, {
    name,
    type,
    color: nextPaletteColor(categories.filter((c) => !c.isArchived).map((c) => c.color)),
    icon: fallbackCategoryIcon,
    group: type === 'expense' ? group : undefined
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
 * "+" under Income or Expenses: something in a category, picked or created by name (a new
 * expense one in the group it was added from). One-time puts the category on the sheet (shown
 * again if it was hidden) with a transaction on its date; with `repeat` it's a recurring item
 * from that date on; with `installments` (on a card) an installment plan whose first rate is
 * on that date. Returns the row it lands in.
 */
export function addMonthLine(
  db: Database,
  input: MonthLineInput,
  today: IsoDate
): { kind: MonthRowKind; sourceId: number } {
  const line = monthLineInputSchema.parse(input)
  monthSheet(db, { month: line.month }, today) // checks the month is in reach
  const added = db.transaction(() => {
    const category = categoryByName(db, line.type, line.name, line.group)
    if (line.repeat) {
      const item = createRecurringItem(db, {
        // In a Subscriptions category it's a subscription.
        kind: category.group === 'subscriptions' ? 'subscription' : line.type,
        title: line.title || category.name,
        amount: line.amount,
        accountId: line.accountId,
        categoryId: category.id,
        frequency: line.repeat.frequency,
        interval: line.repeat.interval,
        anchorDate: line.date,
        nextDueDate: line.date,
        autoPost: false,
        reminderDaysBefore: null
      })
      return { kind: 'recurring' as const, sourceId: item.id }
    }
    if (line.installments !== undefined) {
      const plan = createInstallmentPlan(db, {
        accountId: line.accountId,
        title: line.title || category.name,
        categoryId: category.id,
        totalAmount: line.amount,
        count: line.installments,
        firstDate: line.date,
        note: null
      })
      return { kind: 'installment_plan' as const, sourceId: plan.id }
    }
    ensureRow(db, category.id, today, line.accountId)
    setMonthRowHidden(db, category.id, false)
    if (line.amount > 0) {
      createTransaction(db, {
        type: line.type,
        title: line.title ?? '',
        amount: line.amount,
        date: line.date,
        accountId: line.accountId,
        categoryId: category.id,
        note: null
      })
    }
    return { kind: 'category' as const, sourceId: category.id }
  })()
  // The first installment is usually today's: it's charged straight away.
  if (added.kind === 'installment_plan') postDueInstallments(db, today)
  return added
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
