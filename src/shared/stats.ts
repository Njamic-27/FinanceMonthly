import { z } from 'zod'
import { daysBetween, isIsoDate, type IsoDate } from './dates'
import type { Cents } from './money'

/**
 * What a stretch of time adds up to, by the statistics rules in PLAN.md §2: income and
 * expenses count only income and expense transactions; savings and loan movements are kept
 * apart; transfers between your own accounts don't count at all.
 */
export interface Totals {
  income: Cents
  /** Credit-card purchases count on the day they're made; installments as each rate posts. */
  expenses: Cents
  /** income − expenses */
  net: Cents
  /** Put into savings goals. */
  savingsDeposits: Cents
  /** Taken back out of savings goals. */
  savingsWithdrawals: Cents
  /** Lent to someone, or paid towards a loan. */
  loansOut: Cents
  /** Borrowed, or paid back to you. */
  loansIn: Cents
  /** Everything that came into your accounts minus everything that left them. */
  cashFlow: Cents
  /** Transactions of every type, transfers included. */
  count: number
}

/** One day, week or month of a series. */
export interface PeriodTotals extends Totals {
  /** First day, inclusive; the range's first day if the period starts before it. */
  start: IsoDate
  /** Last day, inclusive; the range's last day if the period ends after it. */
  end: IsoDate
  /**
   * Total balance of all active accounts at the end of `end`, the same total Accounts shows
   * (credit-card debt counts as negative; archived accounts are left out).
   */
  balance: Cents
}

export interface CategoryTotal {
  categoryId: number
  total: Cents
  count: number
}

export const seriesGranularities = ['day', 'week', 'month'] as const
export type SeriesGranularity = (typeof seriesGranularities)[number]

/** Ten years, so a series stays a sensible size. */
export const MAX_RANGE_DAYS = 3660

const isoDate = z.string().refine(isIsoDate, 'Choose a date')

const range = {
  /** First day, inclusive. */
  from: isoDate,
  /** Last day, inclusive. */
  to: isoDate
}

function checkRange(r: { from: IsoDate; to: IsoDate }, ctx: z.RefinementCtx): void {
  if (!isIsoDate(r.from) || !isIsoDate(r.to)) return // already reported on the field
  if (r.from > r.to) {
    ctx.addIssue({ code: 'custom', message: 'The range ends before it starts', path: ['to'] })
  } else if (daysBetween(r.from, r.to) >= MAX_RANGE_DAYS) {
    ctx.addIssue({ code: 'custom', message: 'Choose a range of ten years or less', path: ['to'] })
  }
}

export const statsRangeSchema = z.object(range).strict().superRefine(checkRange)
export type StatsRange = z.input<typeof statsRangeSchema>

/** Weeks start on the day set in Settings. */
export const statsSeriesQuerySchema = z
  .object({ ...range, by: z.enum(seriesGranularities) })
  .strict()
  .superRefine(checkRange)
export type StatsSeriesQuery = z.input<typeof statsSeriesQuerySchema>

export const categoryTotalsQuerySchema = z
  .object({ ...range, type: z.enum(['income', 'expense']) })
  .strict()
  .superRefine(checkRange)
export type CategoryTotalsQuery = z.input<typeof categoryTotalsQuerySchema>
