import { describe, expect, it } from 'vitest'
import { amortizationSchedule, annuityPayment, totalInterest } from './amortization'

describe('annuityPayment', () => {
  it('matches the annuity formula, rounded to the cent', () => {
    // 10,000.00 at 6% over 12 months: 860.66 a month.
    expect(annuityPayment(1000000, 6, 12)).toBe(86066)
    // 20,000.00 at 4.5% over 60 months: 372.86 a month.
    expect(annuityPayment(2000000, 4.5, 60)).toBe(37286)
  })

  it('splits evenly without interest, rounding up', () => {
    expect(annuityPayment(120000, 0, 12)).toBe(10000)
    expect(annuityPayment(100000, 0, 3)).toBe(33334)
  })
})

describe('amortizationSchedule', () => {
  const rows = amortizationSchedule(1000000, 6, 12, '2026-11-15')

  it('pays interest on what is still owed and the rest off the principal', () => {
    expect(rows[0]).toEqual({
      seq: 1,
      dueDate: '2026-11-15',
      amount: 86066,
      principalPart: 81066,
      interestPart: 5000,
      balance: 918934
    })
    // Interest falls and principal grows as the balance goes down.
    expect(rows[1].interestPart).toBeLessThan(rows[0].interestPart)
    expect(rows[1].principalPart).toBeGreaterThan(rows[0].principalPart)
    expect(rows[1].dueDate).toBe('2026-12-15')
  })

  it('ends at exactly zero, the last row taking the rounding', () => {
    const last = rows.at(-1)
    expect(last?.balance).toBe(0)
    expect(rows.reduce((sum, row) => sum + row.principalPart, 0)).toBe(1000000)
    expect(Math.abs((last?.amount ?? 0) - 86066)).toBeLessThan(10)
    expect(rows.every((row) => row.amount === row.principalPart + row.interestPart)).toBe(true)
  })

  it('adds up the interest', () => {
    // 12 × 860.66 − 10,000.00, give or take the last row's rounding.
    expect(Math.abs(totalInterest(rows) - (12 * 86066 - 1000000))).toBeLessThan(10)
  })

  it('works without interest', () => {
    const free = amortizationSchedule(100000, 0, 3, '2026-01-31')
    expect(free.map((r) => [r.dueDate, r.amount, r.interestPart, r.balance])).toEqual([
      ['2026-01-31', 33334, 0, 66666],
      ['2026-02-28', 33334, 0, 33332],
      ['2026-03-31', 33332, 0, 0]
    ])
  })

  it('handles a single payment and long loans', () => {
    expect(amortizationSchedule(50000, 5, 1, '2026-12-01')).toEqual([
      {
        seq: 1,
        dueDate: '2026-12-01',
        amount: 50208,
        principalPart: 50000,
        interestPart: 208,
        balance: 0
      }
    ])
    const mortgage = amortizationSchedule(15000000, 3.5, 360, '2027-01-05')
    expect(mortgage).toHaveLength(360)
    expect(mortgage.at(-1)?.dueDate).toBe('2056-12-05')
    expect(mortgage.at(-1)?.balance).toBe(0)
    expect(mortgage.every((r) => r.principalPart >= 0 && r.interestPart >= 0)).toBe(true)
  })
})
