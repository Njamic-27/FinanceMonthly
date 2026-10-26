import { describe, expect, it } from 'vitest'
import {
  comparisonFor,
  readOverviewPeriod,
  relativeChange,
  stepPeriod,
  switchKind,
  type OverviewPeriod
} from './period'

// Monday 26 October 2026; weeks start on Monday unless a test says otherwise.
const TODAY = '2026-10-26'
const MONDAY = 1

const read = (query: string, weekStart = MONDAY): OverviewPeriod =>
  readOverviewPeriod(new URLSearchParams(query), TODAY, weekStart)

describe('readOverviewPeriod', () => {
  it('defaults to this month', () => {
    expect(read('')).toEqual({
      kind: 'month',
      range: { start: '2026-10-01', end: '2026-10-31' },
      isCurrent: true
    })
  })

  it('reads the week or month around any day', () => {
    expect(read('view=month&date=2026-03-17')).toEqual({
      kind: 'month',
      range: { start: '2026-03-01', end: '2026-03-31' },
      isCurrent: false
    })
    expect(read('view=week&date=2026-10-14').range).toEqual({
      start: '2026-10-12',
      end: '2026-10-18'
    })
    expect(read('view=week&date=2026-10-14', 0).range).toEqual({
      start: '2026-10-11',
      end: '2026-10-17'
    })
  })

  it('ignores a malformed date and never goes past the current period', () => {
    expect(read('view=week&date=2026-02-30').range.start).toBe('2026-10-26')
    expect(read('view=month&date=2027-01-15')).toMatchObject({
      range: { start: '2026-10-01' },
      isCurrent: true
    })
  })
})

describe('stepPeriod', () => {
  it('moves back across year ends and stops at the current period', () => {
    const january = read('view=month&date=2026-01-10')
    expect(stepPeriod(january, -1, TODAY, MONDAY).range).toEqual({
      start: '2025-12-01',
      end: '2025-12-31'
    })
    const september = read('view=month&date=2026-09-10')
    expect(stepPeriod(september, 1, TODAY, MONDAY).isCurrent).toBe(true)
    expect(stepPeriod(read(''), 1, TODAY, MONDAY).range.start).toBe('2026-10-01')
  })
})

describe('switchKind', () => {
  it('goes to the week containing today from the current month', () => {
    expect(switchKind(read(''), 'week', TODAY, MONDAY).range.start).toBe('2026-10-26')
  })

  it('goes to the first week of a past month, and to the month of a past week', () => {
    expect(switchKind(read('date=2026-03-17'), 'week', TODAY, MONDAY).range).toEqual({
      start: '2026-02-23',
      end: '2026-03-01'
    })
    expect(switchKind(read('view=week&date=2026-03-31'), 'month', TODAY, MONDAY).range.start).toBe(
      '2026-03-01'
    )
  })
})

describe('comparisonFor', () => {
  it('compares a past period with the whole previous one', () => {
    expect(comparisonFor(read('date=2026-03-05'), TODAY, MONDAY)).toEqual({
      range: { start: '2026-02-01', end: '2026-02-28' },
      partial: false
    })
  })

  it('compares the current month with the same days of the last one', () => {
    expect(comparisonFor(read(''), TODAY, MONDAY)).toEqual({
      range: { start: '2026-09-01', end: '2026-09-26' },
      partial: true
    })
    // On 31 March, all of February has passed by the same point.
    const march = readOverviewPeriod(new URLSearchParams(''), '2026-03-31', MONDAY)
    expect(comparisonFor(march, '2026-03-31', MONDAY)).toEqual({
      range: { start: '2026-02-01', end: '2026-02-28' },
      partial: false
    })
  })

  it('compares the current week with the same days of last week', () => {
    const week = readOverviewPeriod(new URLSearchParams('view=week'), '2026-10-28', MONDAY)
    expect(comparisonFor(week, '2026-10-28', MONDAY)).toEqual({
      range: { start: '2026-10-19', end: '2026-10-21' },
      partial: true
    })
  })
})

describe('relativeChange', () => {
  it('is the change as a fraction of the previous value', () => {
    expect(relativeChange(125, 100)).toBe(0.25)
    expect(relativeChange(50, 100)).toBe(-0.5)
    expect(relativeChange(10, 0)).toBeNull()
  })
})
