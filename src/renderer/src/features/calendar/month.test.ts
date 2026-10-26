import { describe, expect, it } from 'vitest'
import {
  calendarParams,
  lastCalendarMonth,
  readCalendarMonth,
  stepMonth,
  weekdayLabels
} from './month'

const TODAY = '2026-10-26'
const read = (query: string): string => readCalendarMonth(new URLSearchParams(query), TODAY)

describe('readCalendarMonth', () => {
  it('reads the month or falls back to this one', () => {
    expect(read('month=2025-02')).toBe('2025-02-01')
    expect(read('')).toBe('2026-10-01')
    expect(read('month=2025-13')).toBe('2026-10-01')
    expect(read('month=february')).toBe('2026-10-01')
  })

  it('goes no further than 24 months ahead', () => {
    expect(lastCalendarMonth(TODAY)).toBe('2028-10-01')
    expect(read('month=2028-10')).toBe('2028-10-01')
    expect(read('month=2031-01')).toBe('2028-10-01')
  })

  it('round-trips through the URL', () => {
    expect(read(calendarParams('2027-03-01').toString())).toBe('2027-03-01')
  })
})

describe('stepMonth', () => {
  it('steps back to any month and forward to the last one', () => {
    expect(stepMonth('2026-10-01', -1, TODAY)).toBe('2026-09-01')
    expect(stepMonth('2026-01-01', -1, TODAY)).toBe('2025-12-01')
    expect(stepMonth('2028-09-01', 1, TODAY)).toBe('2028-10-01')
    expect(stepMonth('2028-10-01', 1, TODAY)).toBe('2028-10-01')
  })
})

describe('weekdayLabels', () => {
  it('starts on the chosen day', () => {
    expect(weekdayLabels(1, 'en-GB')).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
    expect(weekdayLabels(0, 'en-GB')[0]).toBe('Sun')
    expect(weekdayLabels(6, 'en-GB')[0]).toBe('Sat')
  })
})
