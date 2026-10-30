import type { Database } from 'better-sqlite3'
import {
  categoryCreateSchema,
  categoryIcons,
  categoryIdSchema,
  categoryUpdateSchema,
  expenseGroups,
  fallbackCategoryIcon,
  type Category,
  type CategoryCreate,
  type CategoryIcon,
  type CategoryType,
  type CategoryUpdate,
  type ExpenseGroup
} from '@shared/categories'
import { isPaletteColor, neutralPaletteColor } from '@shared/palette'
import { AppError } from '../../errors'
import { isMessageKey, languages, translate, type Language } from '@shared/i18n'
import { t } from '@shared/i18n'

interface CategoryRow {
  id: number
  name: string
  type: CategoryType
  color: string | null
  icon: string | null
  is_archived: number
  sort_order: number
  expense_group: string | null
  builtin_key: string | null
  transaction_count: number
  usage_count: number
}

/** Tables whose rows point at a category. */
const referencingTables = ['transactions', 'recurring_items', 'installment_plans'] as const

const selectCategories = /* sql */ `
  SELECT c.*,
         (SELECT count(*) FROM transactions t WHERE t.category_id = c.id) AS transaction_count,
         ${referencingTables
           .map((table) => `(SELECT count(*) FROM ${table} r WHERE r.category_id = c.id)`)
           .join(' + ')} AS usage_count
  FROM categories c`

const isIcon = (value: string | null): value is CategoryIcon =>
  (categoryIcons as readonly (string | null)[]).includes(value)

function toCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    color: isPaletteColor(row.color) ? row.color : neutralPaletteColor,
    icon: isIcon(row.icon) ? row.icon : fallbackCategoryIcon,
    isArchived: row.is_archived === 1,
    sortOrder: row.sort_order,
    group:
      row.type !== 'expense'
        ? null
        : (expenseGroups as readonly (string | null)[]).includes(row.expense_group)
          ? (row.expense_group as ExpenseGroup)
          : 'everyday',
    builtinKey: row.builtin_key,
    transactionCount: row.transaction_count,
    usageCount: row.usage_count
  }
}

/** Income first, then expenses; each in the user's order. Archived ones are included. */
export function listCategories(db: Database): Category[] {
  const rows = db
    .prepare(`${selectCategories} ORDER BY c.type DESC, c.sort_order, c.name`)
    .all() as CategoryRow[]
  return rows.map(toCategory)
}

export function getCategory(db: Database, id: number): Category {
  const row = db.prepare(`${selectCategories} WHERE c.id = ?`).get(categoryIdSchema.parse(id)) as
    CategoryRow | undefined
  if (!row) throw new AppError('not_found', t('errors.categoryGone'))
  return toCategory(row)
}

/** Names are unique per type, ignoring case (the column is COLLATE NOCASE). */
function assertNameFree(db: Database, type: CategoryType, name: string, exceptId?: number): void {
  const clash = db
    .prepare('SELECT is_archived FROM categories WHERE type = ? AND name = ? AND id IS NOT ?')
    .get(type, name, exceptId ?? null) as { is_archived: number } | undefined
  if (clash) {
    throw new AppError(
      'conflict',
      clash.is_archived
        ? t(
            type === 'income' ? 'errors.archivedIncomeCategory' : 'errors.archivedExpenseCategory',
            { name }
          )
        : t(type === 'income' ? 'errors.incomeCategoryExists' : 'errors.expenseCategoryExists', {
            name
          })
    )
  }
}

export function createCategory(db: Database, input: CategoryCreate): Category {
  const { name, type, color, icon, group } = categoryCreateSchema.parse(input)
  assertNameFree(db, type, name)
  // Expense categories always have a group; income ones never do.
  const expenseGroup = type === 'expense' ? (group ?? 'everyday') : null
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO categories (name, type, color, icon, expense_group, sort_order)
       VALUES (?, ?, ?, ?, ?, (SELECT coalesce(max(sort_order), 0) + 1 FROM categories WHERE type = ?))`
    )
    .run(name, type, color, icon, expenseGroup, type)
  return getCategory(db, Number(lastInsertRowid))
}

export function updateCategory(db: Database, id: number, patch: CategoryUpdate): Category {
  const valid = categoryUpdateSchema.parse(patch)
  const current = getCategory(db, id)
  if (valid.name !== undefined) assertNameFree(db, current.type, valid.name, id)

  const columns = {
    name: valid.name,
    color: valid.color,
    icon: valid.icon,
    is_archived: valid.isArchived === undefined ? undefined : Number(valid.isArchived),
    expense_group: current.type === 'expense' ? valid.group : undefined
  }
  const changes = Object.entries(columns).filter(([, value]) => value !== undefined)
  if (changes.length > 0) {
    db.prepare(
      `UPDATE categories SET ${changes.map(([column]) => `${column} = ?`).join(', ')} WHERE id = ?`
    ).run(...changes.map(([, value]) => value), id)
  }
  return getCategory(db, id)
}

/** Only unused categories can be deleted; used ones are archived or merged instead. */
export function deleteCategory(db: Database, id: number): void {
  const category = getCategory(db, id)
  if (category.usageCount > 0) {
    const uses =
      category.transactionCount === category.usageCount
        ? `${category.transactionCount} transaction${category.transactionCount === 1 ? '' : 's'}`
        : String(category.usageCount)
    throw new AppError('conflict', t('errors.categoryInUse', { name: category.name, count: uses }))
  }
  db.prepare('DELETE FROM categories WHERE id = ?').run(id)
}

/** Moves everything in `sourceId` to `targetId`, then deletes the source. Returns the target. */
export function mergeCategory(db: Database, sourceId: number, targetId: number): Category {
  const source = getCategory(db, sourceId)
  const target = getCategory(db, targetId)
  if (source.id === target.id) {
    throw new AppError('validation', t('errors.mergeDifferent'))
  }
  if (source.type !== target.type) {
    throw new AppError(
      'validation',
      t(source.type === 'income' ? 'errors.mergeIncome' : 'errors.mergeExpense', {
        name: source.name
      })
    )
  }

  db.transaction(() => {
    // A month can hold one summary per category: where both have one, the target's takes in
    // the source's.
    const sameMonthSummary = (category: string): string => /* sql */ `
      SELECT s.amount FROM transactions s
      WHERE s.is_month_total = 1 AND s.category_id = @${category}
        AND substr(s.date, 1, 7) = substr(transactions.date, 1, 7)`
    const ids = { source: source.id, target: target.id }
    db.prepare(
      `UPDATE transactions SET amount = amount + (${sameMonthSummary('source')})
       WHERE is_month_total = 1 AND category_id = @target AND EXISTS (${sameMonthSummary('source')})`
    ).run(ids)
    db.prepare(
      `DELETE FROM transactions
       WHERE is_month_total = 1 AND category_id = @source AND EXISTS (${sameMonthSummary('target')})`
    ).run(ids)
    // The target keeps its Month sheet row, or takes over the source's.
    db.prepare(
      `UPDATE month_rows SET category_id = @target
       WHERE category_id = @source AND NOT EXISTS (SELECT 1 FROM month_rows WHERE category_id = @target)`
    ).run(ids)
    for (const table of referencingTables) {
      db.prepare(`UPDATE ${table} SET category_id = ? WHERE category_id = ?`).run(
        target.id,
        source.id
      )
    }
    db.prepare('DELETE FROM categories WHERE id = ?').run(source.id)
  })()
  return getCategory(db, target.id)
}

/**
 * Renames the built-in categories into `language` (PLAN.md step 55): those still carrying a
 * built-in name, in any language. One the user renamed keeps its name, and so does one whose
 * new name another category of its type already has. Returns how many were renamed.
 */
export function renameBuiltinCategories(db: Database, language: Language): number {
  const rows = db
    .prepare('SELECT id, type, name, builtin_key FROM categories WHERE builtin_key IS NOT NULL')
    .all() as { id: number; type: CategoryType; name: string; builtin_key: string }[]
  const taken = db.prepare('SELECT 1 FROM categories WHERE type = ? AND name = ? AND id != ?')
  const rename = db.prepare('UPDATE categories SET name = ? WHERE id = ?')
  let renamed = 0
  db.transaction(() => {
    for (const row of rows) {
      const key = `builtin.${row.builtin_key}`
      if (!isMessageKey(key) || !languages.some((other) => translate(other, key) === row.name))
        continue
      const name = translate(language, key)
      if (name === row.name || taken.get(row.type, name, row.id)) continue
      rename.run(name, row.id)
      renamed += 1
    }
  })()
  return renamed
}
