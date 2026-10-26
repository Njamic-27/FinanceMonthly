import { describe, expect, it } from 'vitest'
import { heatLevel, readHistory, yearComparison, yearComparisonLabel } from './year'

const TODAY = '2026-10-26'
const read = (query: string): ReturnType<typeof readHistory> =>
  readHistory(new URLSearchParams(query), TODAY)

describe('readHistory', () => {
  it('defaults to this year by month', () => {
    expect(read('')).toEqual({ year: 2026, view: 'month' })
  })

  it('reads a past year and the week view', () => {
    expect(read('year=2024&view=week')).toEqual({ year: 2024, view: 'week' })
  })

  it('ignores malformed and future years', () => {
    expect(read('year=abc').year).toBe(2026)
    expect(read('year=2025.5').year).toBe(2026)
    expect(read('year=2027').year).toBe(2026)
  })
})

describe('yearComparison', () => {
  it('compares a past year with the whole year before', () => {
    expect(yearComparison(2025, TODAY)).toEqual({
      range: { start: '2024-01-01', end: '2024-12-31' },
      partial: false
    })
  })

  it('compares this year with the same days of the last one', () => {
    const comparison = yearComparison(2026, TODAY)
    expect(comparison).toEqual({
      range: { start: '2025-01-01', end: '2025-10-26' },
      partial: true
    })
    expect(yearComparisonLabel(comparison, 'en-GB')).toMatch(/^1 Jan\s*–\s*26 Oct 2025$/)
    expect(yearComparisonLabel(yearComparison(2025, TODAY), 'en-GB')).toBe('2024')
  })

  it('is the whole last year on 31 December', () => {
    expect(yearComparison(2026, '2026-12-31')).toEqual({
      range: { start: '2025-01-01', end: '2025-12-31' },
      partial: false
    })
  })
})

describe('heatLevel', () => {
  it('is 0 for nothing and spreads the rest from the lowest to the highest', () => {
    expect(heatLevel(0, 1300, 1600)).toBe(0)
    expect(heatLevel(1300, 1300, 1600)).toBe(1)
    expect(heatLevel(1374, 1300, 1600)).toBe(1)
    expect(heatLevel(1376, 1300, 1600)).toBe(2)
    expect(heatLevel(1500, 1300, 1600)).toBe(3)
    expect(heatLevel(1600, 1300, 1600)).toBe(4)
  })

  it('puts values that are all alike in the middle', () => {
    expect(heatLevel(500, 500, 500)).toBe(2)
  })
})
