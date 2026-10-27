import { describe, expect, it } from 'vitest'
import { goalEta, goalShare, monthlyNeeded, onTrack } from './savings'

const TODAY = '2026-10-27'
const holiday = {
  saved: 120000,
  targetAmount: 200000,
  plannedMonthly: 15000,
  targetDate: '2027-06-01'
}

describe('goalShare', () => {
  it('is the part of the target saved, never below zero', () => {
    expect(goalShare(holiday)).toBe(0.6)
    expect(goalShare({ saved: 250000, targetAmount: 200000 })).toBe(1.25)
    expect(goalShare({ saved: -100, targetAmount: 200000 })).toBe(0)
  })
})

describe('goalEta', () => {
  it('counts monthly deposits from this month', () => {
    // 800 left at 150 a month: 6 deposits, October to March.
    expect(goalEta(holiday, TODAY)).toBe('2027-03-01')
    expect(goalEta({ ...holiday, plannedMonthly: 80000 }, TODAY)).toBe('2026-10-01')
    expect(goalEta({ ...holiday, plannedMonthly: 40000 }, TODAY)).toBe('2026-11-01')
  })

  it('is today once reached, and unknown without a plan', () => {
    expect(goalEta({ ...holiday, saved: 200000 }, TODAY)).toBe(TODAY)
    expect(goalEta({ ...holiday, plannedMonthly: null }, TODAY)).toBeNull()
  })
})

describe('monthlyNeeded', () => {
  it('spreads what is left over the months to the target, this one and its own included', () => {
    // October to June is 9 months: 800 / 9 = 88.89 (rounded up).
    expect(monthlyNeeded(holiday, TODAY)).toBe(8889)
    expect(monthlyNeeded({ ...holiday, targetDate: '2026-11-15' }, TODAY)).toBe(40000)
  })

  it('asks for everything when the date is this month or past', () => {
    expect(monthlyNeeded({ ...holiday, targetDate: '2026-10-31' }, TODAY)).toBe(80000)
    expect(monthlyNeeded({ ...holiday, targetDate: '2026-01-01' }, TODAY)).toBe(80000)
  })

  it('is nothing once reached, and unknown without a date', () => {
    expect(monthlyNeeded({ ...holiday, saved: 210000 }, TODAY)).toBe(0)
    expect(monthlyNeeded({ ...holiday, targetDate: null }, TODAY)).toBeNull()
  })
})

describe('onTrack', () => {
  it('compares the estimate with the target date', () => {
    expect(onTrack(holiday, TODAY)).toBe(true)
    expect(onTrack({ ...holiday, targetDate: '2027-02-01' }, TODAY)).toBe(false)
    expect(onTrack({ ...holiday, plannedMonthly: null }, TODAY)).toBe(false)
    expect(onTrack({ ...holiday, targetDate: null }, TODAY)).toBeNull()
  })
})

describe('a deposit already made this month', () => {
  const deposited = { ...holiday, lastDepositDate: '2026-10-11' }

  it('starts the plan next month', () => {
    // 6 deposits of 150 from November: April.
    expect(goalEta(deposited, TODAY)).toBe('2027-04-01')
    expect(goalEta({ ...holiday, lastDepositDate: '2026-09-11' }, TODAY)).toBe('2027-03-01')
  })

  it('leaves this month out of what each month needs', () => {
    // November to June is 8 months: 800 / 8 = 100.
    expect(monthlyNeeded(deposited, TODAY)).toBe(10000)
    expect(monthlyNeeded({ ...deposited, targetDate: '2026-10-31' }, TODAY)).toBe(80000)
  })
})
