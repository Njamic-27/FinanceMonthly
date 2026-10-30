import { describe, expect, it } from 'vitest'
import {
  installmentPlanInputSchema,
  installmentSchedule,
  installmentTitle,
  splitInstallments
} from './installments'

describe('splitInstallments', () => {
  it('splits evenly when it can', () => {
    expect(splitInstallments(200000, 5)).toEqual([40000, 40000, 40000, 40000, 40000])
  })

  it('puts the leftover cents on the last installment', () => {
    expect(splitInstallments(100000, 3)).toEqual([33333, 33333, 33334])
    expect(splitInstallments(104999, 5)).toEqual([20999, 20999, 20999, 20999, 21003])
    expect(splitInstallments(2, 2)).toEqual([1, 1])
  })

  it('always adds up to the total', () => {
    for (const [total, count] of [
      [1, 1],
      [99, 2],
      [123457, 7],
      [999999, 60],
      [60, 60]
    ]) {
      const parts = splitInstallments(total, count)
      expect(parts).toHaveLength(count)
      expect(parts.reduce((a, b) => a + b, 0)).toBe(total)
      expect(Math.min(...parts)).toBeGreaterThan(0)
    }
  })
})

describe('installmentSchedule', () => {
  it('charges monthly from the first date, keeping the day after short months', () => {
    expect(installmentSchedule(100000, 3, '2026-01-31')).toEqual([
      { seq: 1, date: '2026-01-31', amount: 33333 },
      { seq: 2, date: '2026-02-28', amount: 33333 },
      { seq: 3, date: '2026-03-31', amount: 33334 }
    ])
  })

  it('crosses into the next year', () => {
    expect(installmentSchedule(40000, 4, '2026-11-15').map((i) => i.date)).toEqual([
      '2026-11-15',
      '2026-12-15',
      '2027-01-15',
      '2027-02-15'
    ])
  })
})

describe('installmentTitle', () => {
  it('numbers each installment', () => {
    expect(installmentTitle('Laptop', 2, 5)).toBe('Laptop 2/5')
  })
})

describe('installmentPlanInputSchema', () => {
  const plan = {
    accountId: 1,
    title: 'Laptop',
    categoryId: 1,
    totalAmount: 200000,
    count: 5,
    firstDate: '2026-10-27',
    note: null
  }
  const error = (overrides: object): string | undefined => {
    const result = installmentPlanInputSchema.safeParse({ ...plan, ...overrides })
    return result.success ? undefined : result.error.issues[0].message
  }

  it('accepts 2 to 60 installments', () => {
    expect(error({})).toBeUndefined()
    expect(error({ count: 2 })).toBeUndefined()
    expect(error({ count: 60 })).toBeUndefined()
    expect(error({ count: 1 })).toMatch(/2 to 60/)
    expect(error({ count: 61 })).toMatch(/2 to 60/)
  })

  it('needs at least a cent per installment', () => {
    expect(error({ totalAmount: 4, count: 5 })).toMatch(/at least one cent/)
  })
})
