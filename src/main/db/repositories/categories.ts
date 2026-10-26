import type { Database } from 'better-sqlite3'
import {
  categoryCreateSchema,
  categoryIcons,
  categoryIdSchema,
  categoryUpdateSchema,
  fallbackCategoryIcon,
  type Category,
  type CategoryCreate,
  type CategoryIcon,
  type CategoryType,
  type CategoryUpdate
} from '@shared/categories'
import { isPaletteColor, neutralPaletteColor } from '@shared/palette'
import { AppError } from '../../errors'

interface CategoryRow {
  id: number
  name: string
  type: CategoryType
  color: string | null
  icon: string | null
  is_archived: number
  sort_order: number
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
  if (!row) throw new AppError('not_found', 'That category no longer exists.')
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
        ? `An archived ${type} category is already called “${name}”. Restore it instead.`
        : `There's already an ${type} category called “${name}”.`
    )
  }
}

export function createCategory(db: Database, input: CategoryCreate): Category {
  const { name, type, color, icon } = categoryCreateSchema.parse(input)
  assertNameFree(db, type, name)
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO categories (name, type, color, icon, sort_order)
       VALUES (?, ?, ?, ?, (SELECT coalesce(max(sort_order), 0) + 1 FROM categories WHERE type = ?))`
    )
    .run(name, type, color, icon, type)
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
    is_archived: valid.isArchived === undefined ? undefined : Number(valid.isArchived)
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
        : `${category.usageCount} transactions, recurring items or installment plans`
    throw new AppError(
      'conflict',
      `“${category.name}” is used by ${uses}. Archive it or merge it into another category instead.`
    )
  }
  db.prepare('DELETE FROM categories WHERE id = ?').run(id)
}

/** Moves everything in `sourceId` to `targetId`, then deletes the source. Returns the target. */
export function mergeCategory(db: Database, sourceId: number, targetId: number): Category {
  const source = getCategory(db, sourceId)
  const target = getCategory(db, targetId)
  if (source.id === target.id) {
    throw new AppError('validation', 'Choose a different category to merge into.')
  }
  if (source.type !== target.type) {
    throw new AppError(
      'validation',
      `“${source.name}” is an ${source.type} category, so it can only be merged into another ${source.type} category.`
    )
  }

  db.transaction(() => {
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
