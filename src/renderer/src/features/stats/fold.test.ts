import { describe, expect, it } from 'vitest'
import { foldCategoryTotals } from './fold'

const totals = [500, 400, 300, 200, 100].map((total, i) => ({
  categoryId: i + 1,
  total,
  count: 1
}))

describe('foldCategoryTotals', () => {
  it('keeps everything when it fits', () => {
    expect(foldCategoryTotals(totals, 5)).toEqual({ rows: totals, other: null })
  })

  it('folds the smallest into Other, which takes the last slot', () => {
    expect(foldCategoryTotals(totals, 3)).toEqual({
      rows: totals.slice(0, 2),
      other: { total: 600, count: 3, categories: 3 }
    })
  })
})
