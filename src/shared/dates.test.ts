import { describe, expect, it } from 'vitest'
import {
  addDays,
  addMonths,
  daysBetween,
  daysInMonth,
  eachDay,
  endOfMonth,
  formatDate,
  formatPeriod,
  isIsoDate,
  parseIsoDate,
  periodContaining,
  periodsBetween,
  shiftPeriod,
  startOfWeek,
  today
} from './dates'

const MONDAY = 1
const SUNDAY = 0

describe('ISO dates', () => {
  it('validates real calendar dates only', () => {
    expect(isIsoDate('2026-10-26')).toBe(true)
    expect(isIsoDate('2028-02-29')).toBe(true)
    expect(isIsoDate('2026-02-29')).toBe(false)
    expect(isIsoDate('2026-13-01')).toBe(false)
    expect(isIsoDate('2026-1-5')).toBe(false)
    expect(() => parseIsoDate('2026-02-30')).toThrow()
  })

  it('takes today from the local date', () => {
    expect(today(new Date(2026, 9, 26, 23, 59))).toBe('2026-10-26')
    expect(today(new Date(2026, 9, 27, 0, 1))).toBe('2026-10-27')
  })
})

describe('arithmetic', () => {
  it('adds days across daylight-saving changes', () => {
    // Europe/Zagreb: clocks go back on 2026-10-25 and forward on 2026-03-29.
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25')
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26')
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2)
    expect(eachDay('2026-03-28', '2026-03-30')).toEqual(['2026-03-28', '2026-03-29', '2026-03-30'])
  })

  it('clamps months to their last day', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29')
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28')
    expect(addMonths('2026-10-15', 24)).toBe('2028-10-15')
    expect(daysInMonth('2028-02-10')).toBe(29)
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28')
  })
})

describe('weeks respect the first day of the week', () => {
  it('starts on Monday or Sunday', () => {
    // 2026-10-25 is a Sunday.
    expect(startOfWeek('2026-10-25', MONDAY)).toBe('2026-10-19')
    expect(startOfWeek('2026-10-25', SUNDAY)).toBe('2026-10-25')
    expect(periodContaining('week', '2026-10-26', MONDAY)).toEqual({
      start: '2026-10-26',
      end: '2026-11-01'
    })
    expect(periodContaining('week', '2026-10-26', SUNDAY)).toEqual({
      start: '2026-10-25',
      end: '2026-10-31'
    })
  })

  it('spans a year boundary', () => {
    expect(periodContaining('week', '2027-01-01', MONDAY)).toEqual({
      start: '2026-12-28',
      end: '2027-01-03'
    })
  })
})

describe('periods', () => {
  it('finds the month containing a date', () => {
    expect(periodContaining('month', '2026-02-14', MONDAY)).toEqual({
      start: '2026-02-01',
      end: '2026-02-28'
    })
  })

  it('steps to previous and next periods', () => {
    expect(shiftPeriod('month', '2026-01-31', -1, MONDAY)).toEqual({
      start: '2025-12-01',
      end: '2025-12-31'
    })
    expect(shiftPeriod('month', '2026-01-31', 1, MONDAY)).toEqual({
      start: '2026-02-01',
      end: '2026-02-28'
    })
    expect(shiftPeriod('week', '2026-10-28', -1, MONDAY)).toEqual({
      start: '2026-10-19',
      end: '2026-10-25'
    })
  })

  it('lists every period overlapping a range', () => {
    expect(periodsBetween('month', '2026-11-15', '2027-01-02', MONDAY).map((p) => p.start)).toEqual(
      ['2026-11-01', '2026-12-01', '2027-01-01']
    )
    const weeks = periodsBetween('week', '2026-10-01', '2026-10-31', MONDAY)
    expect(weeks[0]).toEqual({ start: '2026-09-28', end: '2026-10-04' })
    expect(weeks.at(-1)).toEqual({ start: '2026-10-26', end: '2026-11-01' })
    expect(weeks).toHaveLength(5)
  })

  it('covers 24 months ahead', () => {
    expect(periodsBetween('month', '2026-10-26', addMonths('2026-10-26', 24), MONDAY)).toHaveLength(
      25
    )
  })
})

describe('formatting', () => {
  const plain = (s: string): string => s.replace(/[\u00a0\u202f\u2009]/g, ' ')

  it('formats dates in the locale', () => {
    expect(formatDate('2026-10-26', 'en-GB')).toBe('26 Oct 2026')
    expect(formatDate('2026-10-26', 'en-US')).toBe('Oct 26, 2026')
  })

  it('formats months and weeks', () => {
    expect(formatPeriod('month', { start: '2026-10-01', end: '2026-10-31' }, 'en-GB')).toBe(
      'October 2026'
    )
    expect(plain(formatPeriod('week', { start: '2026-10-19', end: '2026-10-25' }, 'en-GB'))).toBe(
      '19 – 25 Oct 2026'
    )
  })
})
