import { describe, expect, it } from 'vitest'
import {
  monthlyCost,
  recurringItemInputSchema,
  yearlyCost,
  type RecurringItemInput
} from './recurring'
import { subscriptionPresets } from './subscription-presets'

describe('costs', () => {
  it('converts any schedule to a year and an average month', () => {
    const netflix = { amount: 1399, frequency: 'monthly', interval: 1 } as const
    expect(yearlyCost(netflix)).toBe(16788)
    expect(monthlyCost(netflix)).toBe(1399)

    const office = { amount: 9999, frequency: 'yearly', interval: 1 } as const
    expect(yearlyCost(office)).toBe(9999)
    expect(monthlyCost(office)).toBe(833)

    const quarterly = { amount: 3000, frequency: 'monthly', interval: 3 } as const
    expect(yearlyCost(quarterly)).toBe(12000)
    expect(monthlyCost(quarterly)).toBe(1000)

    // 52.18 weeks in an average year.
    const weekly = { amount: 1000, frequency: 'weekly', interval: 1 } as const
    expect(yearlyCost(weekly)).toBe(52178)
    expect(monthlyCost(weekly)).toBe(4348)
    expect(yearlyCost({ ...weekly, interval: 2 })).toBe(26089)
  })
})

describe('recurringItemInputSchema', () => {
  const input = (url: string | null): RecurringItemInput => ({
    kind: 'subscription',
    title: 'Netflix',
    amount: 1399,
    accountId: 1,
    categoryId: 1,
    frequency: 'monthly',
    interval: 1,
    anchorDate: '2026-11-05',
    nextDueDate: '2026-11-05',
    autoPost: false,
    reminderDaysBefore: 2,
    url
  })
  const url = (value: string | null): unknown => {
    const parsed = recurringItemInputSchema.safeParse(input(value))
    return parsed.success ? parsed.data.url : parsed.error.issues[0].message
  }

  it('saves web addresses with their scheme', () => {
    expect(url('netflix.com')).toBe('https://netflix.com')
    expect(url(' https://www.netflix.com/account ')).toBe('https://www.netflix.com/account')
    expect(url('HTTP://example.org')).toBe('HTTP://example.org')
    expect(url('')).toBeNull()
    expect(url(null)).toBeNull()
  })

  it('refuses anything else', () => {
    expect(url('netflix')).toMatch(/web address/)
    expect(url('javascript:alert(1)')).toMatch(/web address/)
    expect(url('file:///C:/secret.txt')).toMatch(/web address/)
  })
})

describe('subscriptionPresets', () => {
  it('has unique names', () => {
    expect(new Set(subscriptionPresets).size).toBe(subscriptionPresets.length)
  })
})
