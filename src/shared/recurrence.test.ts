import { describe, expect, it } from 'vitest'
import { addDays, monthlySchedule } from './dates'
import { nextOccurrence, occurrences, type Schedule } from './recurrence'

const monthly = (anchorDate: string, interval = 1, endDate: string | null = null): Schedule => ({
  frequency: 'monthly',
  interval,
  anchorDate,
  endDate
})

describe('occurrences', () => {
  it('moves the 31st to the last day of shorter months and back again', () => {
    expect(occurrences(monthly('2026-01-31'), '2026-01-01', '2026-06-30')).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
      '2026-05-31',
      '2026-06-30'
    ])
    expect(occurrences(monthly('2028-01-30'), '2028-02-01', '2028-03-31')).toEqual([
      '2028-02-29',
      '2028-03-30'
    ])
  })

  it('follows a payday anchored before its next due date', () => {
    // Onboarding on 2 Nov with payday 31: anchor 31 Oct, next due 30 Nov.
    expect(occurrences(monthly('2026-10-31'), '2026-11-30', '2027-03-31')).toEqual([
      '2026-11-30',
      '2026-12-31',
      '2027-01-31',
      '2027-02-28',
      '2027-03-31'
    ])
  })

  it('agrees with monthlySchedule for every payday', () => {
    for (let day = 1; day <= 31; day++) {
      for (const today of ['2026-02-05', '2026-11-02', '2028-02-28', '2026-12-31']) {
        const { anchorDate, nextDueDate } = monthlySchedule(day, today)
        expect(occurrences(monthly(anchorDate), today, nextDueDate)).toEqual([nextDueDate])
      }
    }
  })

  it('skips months for an interval', () => {
    expect(occurrences(monthly('2026-01-15', 3), '2026-01-01', '2026-12-31')).toEqual([
      '2026-01-15',
      '2026-04-15',
      '2026-07-15',
      '2026-10-15'
    ])
    expect(occurrences(monthly('2025-11-30', 3), '2026-01-01', '2026-12-31')).toEqual([
      '2026-02-28',
      '2026-05-30',
      '2026-08-30',
      '2026-11-30'
    ])
  })

  it('repeats weekly on the same weekday, across daylight-saving changes', () => {
    const weekly: Schedule = {
      frequency: 'weekly',
      interval: 1,
      anchorDate: '2026-10-12',
      endDate: null
    }
    expect(occurrences(weekly, '2026-10-20', '2026-11-03')).toEqual(['2026-10-26', '2026-11-02'])
    expect(occurrences({ ...weekly, interval: 2 }, '2026-10-01', '2026-11-30')).toEqual([
      '2026-10-12',
      '2026-10-26',
      '2026-11-09',
      '2026-11-23'
    ])
    expect(occurrences(weekly, '2026-12-25', '2027-01-10')).toEqual(['2026-12-28', '2027-01-04'])
  })

  it('repeats yearly, putting 29 February on the 28th in other years', () => {
    const yearly: Schedule = {
      frequency: 'yearly',
      interval: 1,
      anchorDate: '2028-02-29',
      endDate: null
    }
    expect(occurrences(yearly, '2028-01-01', '2032-12-31')).toEqual([
      '2028-02-29',
      '2029-02-28',
      '2030-02-28',
      '2031-02-28',
      '2032-02-29'
    ])
    expect(occurrences({ ...yearly, interval: 2 }, '2029-01-01', '2033-12-31')).toEqual([
      '2030-02-28',
      '2032-02-29'
    ])
  })

  it('includes both ends of the range', () => {
    expect(occurrences(monthly('2026-01-10'), '2026-02-10', '2026-04-10')).toEqual([
      '2026-02-10',
      '2026-03-10',
      '2026-04-10'
    ])
    expect(occurrences(monthly('2026-01-10'), '2026-02-11', '2026-03-09')).toEqual([])
  })

  it('starts at the anchor and stops after the end date', () => {
    expect(occurrences(monthly('2026-03-05'), '2026-01-01', '2026-04-30')).toEqual([
      '2026-03-05',
      '2026-04-05'
    ])
    expect(occurrences(monthly('2026-01-05', 1, '2026-03-05'), '2026-01-01', '2026-12-31')).toEqual(
      ['2026-01-05', '2026-02-05', '2026-03-05']
    )
    expect(occurrences(monthly('2026-01-05', 1, '2026-03-04'), '2026-01-01', '2026-12-31')).toEqual(
      ['2026-01-05', '2026-02-05']
    )
    expect(occurrences(monthly('2026-01-05', 1, '2026-03-05'), '2026-04-01', '2026-12-31')).toEqual(
      []
    )
    expect(occurrences(monthly('2026-01-05'), '2026-05-01', '2026-04-01')).toEqual([])
  })

  it('finds occurrences long after the anchor', () => {
    expect(occurrences(monthly('2010-01-31'), '2036-02-01', '2036-03-31')).toEqual([
      '2036-02-29',
      '2036-03-31'
    ])
    const weekly: Schedule = {
      frequency: 'weekly',
      interval: 3,
      anchorDate: '2010-01-04',
      endDate: null
    }
    const dates = occurrences(weekly, '2036-01-01', '2036-03-31')
    expect(dates.length).toBeGreaterThan(0)
    for (const date of dates) expect(occurrences(weekly, '2010-01-01', date).at(-1)).toBe(date)
  })

  it('rejects an interval below 1', () => {
    expect(() => occurrences(monthly('2026-01-05', 0), '2026-01-01', '2026-12-31')).toThrow()
  })
})

describe('nextOccurrence', () => {
  it('returns the first occurrence after the date', () => {
    const rent = monthly('2026-01-31')
    expect(nextOccurrence(rent, '2025-12-01')).toBe('2026-01-31')
    expect(nextOccurrence(rent, '2026-01-30')).toBe('2026-01-31')
    expect(nextOccurrence(rent, '2026-01-31')).toBe('2026-02-28')
    expect(nextOccurrence(rent, '2026-02-28')).toBe('2026-03-31')
    expect(nextOccurrence(rent, '2026-03-01')).toBe('2026-03-31')
  })

  it('matches occurrences day after day', () => {
    const schedule = monthly('2026-01-31', 2)
    const dates = occurrences(schedule, '2026-01-01', '2027-12-31')
    for (let day = '2026-01-01'; day < dates.at(-1)!; day = addDays(day, 1)) {
      expect(nextOccurrence(schedule, day)).toBe(dates.find((d) => d > day))
    }
  })

  it('returns null once the schedule has ended', () => {
    const schedule = monthly('2026-01-05', 1, '2026-03-20')
    expect(nextOccurrence(schedule, '2026-02-05')).toBe('2026-03-05')
    expect(nextOccurrence(schedule, '2026-03-05')).toBeNull()
  })
})
