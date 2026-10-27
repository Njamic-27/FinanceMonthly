import { z } from 'zod'
import { endOfMonth, type DateRange, type IsoDate } from './dates'
import { MAX_CENTS, type Cents } from './money'
import type { CalendarSummary } from './planned'

// The Month sheet (PLAN.md §3, Month): one month at a time, like a monthly spreadsheet. Every
// cell is real transactions underneath; typing an amount sets a row's one monthly summary
// transaction, which holds whatever the individual transactions don't.

/** A month as 'YYYY-MM'. */
export type MonthKey = string

const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/

export const isMonthKey = (value: string): boolean => MONTH_KEY.test(value)

export const monthKeyOf = (date: IsoDate): MonthKey => date.slice(0, 7)

export const monthRange = (month: MonthKey): DateRange => ({
  start: `${month}-01`,
  end: endOfMonth(`${month}-01`)
})

/**
 * The date a monthly summary transaction gets: today in the current month, otherwise the
 * month's last day.
 */
export function summaryDate(month: MonthKey, today: IsoDate): IsoDate {
  return monthKeyOf(today) === month ? today : monthRange(month).end
}

export const monthSectionKeys = [
  'income',
  'expenses',
  'subscriptions',
  'cards',
  'loans',
  'savings'
] as const
export type MonthSectionKey = (typeof monthSectionKeys)[number]

export const monthRowKinds = [
  'category',
  'recurring',
  'card_payment',
  'installment_plan',
  'loan',
  'savings'
] as const
export type MonthRowKind = (typeof monthRowKinds)[number]

/**
 * One line of the sheet. Amounts are positive, except on loan rows (+ money in, − money out,
 * as on the balance) and savings rows (deposits − withdrawals, so a month that took more out
 * than it put in is negative).
 */
export interface MonthSheetRow {
  kind: MonthRowKind
  /** The category's, recurring item's, card's, installment plan's, loan's or goal's id. */
  sourceId: number
  /** The month_rows line, for a category added to the sheet; null otherwise. */
  rowId: number | null
  title: string
  /** The account new summaries (or confirmed payments) use; null when there's none to use. */
  accountId: number | null
  categoryId: number | null
  /** Recorded in the month, the summary included. */
  actual: Cents
  /** Of `actual`, what the monthly summary transaction holds. */
  summary: Cents
  /** Expected in the month and not posted yet (shown in the planned style). */
  planned: Cents
  /** Transactions behind `actual`. */
  count: number
  /** Some of `planned` fell due before today. */
  overdue: boolean
  /** Typing an amount on it does something; card installments and personal loans don't. */
  editable: boolean
}

export interface MonthSheetSection {
  key: MonthSectionKey
  rows: MonthSheetRow[]
  actual: Cents
  planned: Cents
}

export interface MonthSheet {
  month: MonthKey
  range: DateRange
  sections: MonthSheetSection[]
  /** The same numbers as the Calendar's month summary. */
  summary: CalendarSummary
}

const monthKey = z.string().refine(isMonthKey, 'Choose a month')

export const monthSheetQuerySchema = z.object({ month: monthKey }).strict()
export type MonthSheetQuery = z.input<typeof monthSheetQuerySchema>

/** Typing an amount into a row's cell. */
export const monthCellInputSchema = z
  .object({
    month: monthKey,
    kind: z.enum(monthRowKinds),
    sourceId: z.number().int().positive(),
    /** 0 removes the summary (or skips or unpays a payment). */
    amount: z
      .number({ error: 'Enter an amount' })
      .int()
      .min(0, 'Enter 0 or more')
      .max(MAX_CENTS, 'That amount is too large'),
    /** The account to use instead of the row's. */
    accountId: z.number().int().positive().optional()
  })
  .strict()
export type MonthCellInput = z.input<typeof monthCellInputSchema>
