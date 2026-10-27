import { describe, expect, it } from 'vitest'
import { periodLabel, periodTick, readProjectionParams } from './labels'

/** Intl puts (thin) spaces around range dashes; compare with plain ones. */
const plain = (text: string): string => text.replace(/\s/g, ' ')

describe('periodLabel', () => {
  it('names whole months, and the days of cut-short ones and weeks', () => {
    expect(plain(periodLabel({ start: '2026-11-01', end: '2026-11-30' }, 'month', 'en-GB'))).toBe(
      'Nov 2026'
    )
    expect(plain(periodLabel({ start: '2026-10-27', end: '2026-10-31' }, 'month', 'en-GB'))).toBe(
      '27 – 31 Oct'
    )
    expect(plain(periodLabel({ start: '2027-10-01', end: '2027-10-27' }, 'month', 'en-GB'))).toBe(
      '1 – 27 Oct'
    )
    expect(plain(periodLabel({ start: '2026-11-30', end: '2026-12-06' }, 'week', 'en-GB'))).toBe(
      '30 Nov – 6 Dec'
    )
  })
})

describe('periodTick', () => {
  it('shows the year only in January', () => {
    expect(periodTick({ start: '2026-11-01', end: '2026-11-30' }, 'month', 'en-GB')).toBe('Nov')
    expect(periodTick({ start: '2027-01-01', end: '2027-01-31' }, 'month', 'en-GB')).toBe('Jan 27')
    expect(periodTick({ start: '2026-11-02', end: '2026-11-08' }, 'week', 'en-GB')).toBe('2 Nov')
  })
})

describe('readProjectionParams', () => {
  it('reads the horizon and granularity, falling back to a year by month', () => {
    expect(readProjectionParams(new URLSearchParams('months=24&by=week'))).toEqual({
      months: 24,
      granularity: 'week'
    })
    expect(readProjectionParams(new URLSearchParams('months=5&by=day'))).toEqual({
      months: 12,
      granularity: 'month'
    })
  })
})
