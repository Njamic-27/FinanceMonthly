import type { CategoryTotal } from '@shared/stats'

export interface FoldedCategories {
  rows: CategoryTotal[]
  /** The smaller categories added together; null when everything fits. */
  other: { total: number; count: number; categories: number } | null
}

/**
 * Keeps the largest categories and folds the rest into "Other", so charts never need more
 * colours than the palette has (DESIGN.md). `totals` must be largest first.
 */
export function foldCategoryTotals(totals: CategoryTotal[], max: number): FoldedCategories {
  if (totals.length <= max) return { rows: totals, other: null }
  const rest = totals.slice(max - 1)
  return {
    rows: totals.slice(0, max - 1),
    other: {
      total: rest.reduce((sum, c) => sum + c.total, 0),
      count: rest.reduce((sum, c) => sum + c.count, 0),
      categories: rest.length
    }
  }
}
