import { addMonths, type IsoDate } from './dates'
import type { Cents } from './money'

/** One row of a loan's repayment schedule. */
export interface AmortizationRow {
  /** 1 to n. */
  seq: number
  dueDate: IsoDate
  /** principalPart + interestPart. */
  amount: Cents
  principalPart: Cents
  interestPart: Cents
  /** Principal still owed after this payment. */
  balance: Cents
}

/** Monthly rate from an annual percentage: 6 → 0.005. */
const monthlyRate = (annualPercent: number): number => annualPercent / 100 / 12

/**
 * The fixed monthly payment of an annuity loan, in whole cents (rounded to the nearest):
 * P · r / (1 − (1 + r)^−n), or simply P / n without interest.
 */
export function annuityPayment(principal: Cents, annualPercent: number, count: number): Cents {
  const r = monthlyRate(annualPercent)
  if (r === 0) return Math.ceil(principal / count)
  return Math.round((principal * r) / (1 - Math.pow(1 + r, -count)))
}

/**
 * The full repayment schedule of an annuity loan: equal monthly payments from `firstDate`
 * (counted from it, so a 31st comes back after short months), each split into the month's
 * interest on what's still owed and the rest off the principal. Rounding to cents is settled
 * on the last row, which pays off exactly what's left.
 */
export function amortizationSchedule(
  principal: Cents,
  annualPercent: number,
  count: number,
  firstDate: IsoDate
): AmortizationRow[] {
  const r = monthlyRate(annualPercent)
  const payment = annuityPayment(principal, annualPercent, count)
  const rows: AmortizationRow[] = []
  let balance = principal
  for (let seq = 1; seq <= count; seq++) {
    const interestPart = Math.round(balance * r)
    // The last payment clears the balance; earlier ones never take more than is left.
    const principalPart =
      seq === count ? balance : Math.min(balance, Math.max(0, payment - interestPart))
    balance -= principalPart
    rows.push({
      seq,
      dueDate: addMonths(firstDate, seq - 1),
      amount: principalPart + interestPart,
      principalPart,
      interestPart,
      balance
    })
  }
  return rows
}

/** Interest paid over the whole loan. */
export const totalInterest = (rows: AmortizationRow[]): Cents =>
  rows.reduce((sum, row) => sum + row.interestPart, 0)
