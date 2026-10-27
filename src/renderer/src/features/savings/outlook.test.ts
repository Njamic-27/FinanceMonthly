import { describe, expect, it } from 'vitest'
import { formatMoney } from '@shared/money'
import type { CurrencyTools } from '@renderer/hooks/useCurrency'
import { goalOutlook } from './outlook'

const settings = { currency: 'EUR', locale: 'en-GB' }
const money = {
  ...settings,
  format: (cents: number) => formatMoney(cents, settings)
} as CurrencyTools
const TODAY = '2026-10-27'
const holiday = {
  saved: 120000,
  targetAmount: 200000,
  plannedMonthly: 15000,
  targetDate: '2027-06-01'
}

describe('goalOutlook', () => {
  it('says when the monthly plan gets there, and whether that is in time', () => {
    expect(goalOutlook(holiday, TODAY, money)).toBe(
      'At €150.00 a month you’ll reach it in March 2027, in time for June 2027.'
    )
    expect(goalOutlook({ ...holiday, targetDate: '2027-01-15' }, TODAY, money)).toBe(
      'At €150.00 a month you’ll reach it in March 2027. To make it by January 2027, put in €200.00 a month.'
    )
    expect(goalOutlook({ ...holiday, targetDate: null }, TODAY, money)).toBe(
      'At €150.00 a month you’ll reach it in March 2027.'
    )
  })

  it('works out the monthly amount without a plan, or just what is left', () => {
    expect(goalOutlook({ ...holiday, plannedMonthly: null }, TODAY, money)).toBe(
      'Put in €88.89 a month to reach it by June 2027.'
    )
    expect(goalOutlook({ ...holiday, plannedMonthly: null, targetDate: null }, TODAY, money)).toBe(
      '€800.00 to go.'
    )
  })

  it('celebrates quietly once reached', () => {
    expect(goalOutlook({ ...holiday, saved: 200000 }, TODAY, money)).toBe('Goal reached.')
  })
})
