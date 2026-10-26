import { describe, expect, it } from 'vitest'
import type { Schedule } from '@shared/recurrence'
import { anchorFor, describeSchedule, ordinal } from './schedule'

const schedule = (overrides: Partial<Schedule>): Schedule => ({
  frequency: 'monthly',
  interval: 1,
  anchorDate: '2026-10-10',
  endDate: null,
  ...overrides
})

describe('ordinal', () => {
  it('uses English suffixes', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 31].map(ordinal)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '21st',
      '22nd',
      '23rd',
      '31st'
    ])
  })
})

describe('describeSchedule', () => {
  it('describes monthly schedules', () => {
    expect(describeSchedule(schedule({}), 'en-GB')).toBe('Monthly on the 10th')
    expect(describeSchedule(schedule({ interval: 3 }), 'en-GB')).toBe('Every 3 months on the 10th')
    expect(describeSchedule(schedule({ anchorDate: '2026-10-31' }), 'en-GB')).toBe(
      'Monthly on the 31st (or the last day of shorter months)'
    )
  })

  it('names the weekday and the date in the app’s locale', () => {
    // 26 October 2026 is a Monday.
    expect(
      describeSchedule(schedule({ frequency: 'weekly', anchorDate: '2026-10-26' }), 'en-GB')
    ).toBe('Every week on Monday')
    expect(
      describeSchedule(
        schedule({ frequency: 'weekly', interval: 2, anchorDate: '2026-10-26' }),
        'hr-HR'
      )
    ).toBe('Every 2 weeks on ponedjeljak')
    expect(
      describeSchedule(schedule({ frequency: 'yearly', anchorDate: '2028-02-29' }), 'en-GB')
    ).toBe('Yearly on 29 February')
  })
})

describe('anchorFor', () => {
  const payday = {
    frequency: 'monthly',
    interval: 1,
    anchorDate: '2026-10-31',
    nextDueDate: '2026-11-30'
  } as const

  it('starts a new schedule from the next date', () => {
    expect(anchorFor(null, { frequency: 'monthly', interval: 1, nextDueDate: '2026-11-30' })).toBe(
      '2026-11-30'
    )
    expect(anchorFor(payday, { ...payday, nextDueDate: '2026-12-15' })).toBe('2026-12-15')
    expect(anchorFor(payday, { ...payday, interval: 2 })).toBe('2026-11-30')
  })

  it('keeps the anchor while the schedule is unchanged', () => {
    expect(anchorFor(payday, payday)).toBe('2026-10-31')
  })
})
