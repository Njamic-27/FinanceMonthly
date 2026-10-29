import { z } from 'zod'
import { endOfMonth, isIsoDate, type DateRange, type IsoDate } from './dates'
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

/** One row of one month: its transactions, or its account. */
export const monthRowQuerySchema = z
  .object({
    month: monthKey,
    kind: z.enum(monthRowKinds),
    sourceId: z.number().int().positive()
  })
  .strict()
export type MonthRowQuery = z.input<typeof monthRowQuerySchema>

/** Choosing a row's account in the Account column. */
export const monthRowAccountInputSchema = monthRowQuerySchema
  .extend({ accountId: z.number().int().positive() })
  .strict()
export type MonthRowAccountInput = z.input<typeof monthRowAccountInputSchema>

const id = z.number().int().positive()

/** The sections a category row can be added to, by category type. */
export const monthLineTypes = ['income', 'expense'] as const
export type MonthLineType = (typeof monthLineTypes)[number]

/**
 * "+" under Income or Expenses: a row by name. An existing category is reused by name,
 * otherwise one is created; "Every month" makes it a recurring item instead.
 */
export const monthLineInputSchema = z
  .object({
    month: monthKey,
    type: z.enum(monthLineTypes),
    name: z
      .string()
      .trim()
      .min(1, 'Give the row a name')
      .max(40, 'Keep the name to 40 characters or fewer'),
    /** This month's amount; 0 adds the row empty. */
    amount: z
      .number({ error: 'Enter an amount' })
      .int()
      .min(0, 'Enter 0 or more')
      .max(MAX_CENTS, 'That amount is too large'),
    accountId: z.number({ error: 'Choose an account' }).int().positive('Choose an account'),
    everyMonth: z.boolean(),
    /** Every month: the first payment's date. */
    date: z.string().refine(isIsoDate, 'Choose a date').optional()
  })
  .strict()
  .superRefine((line, ctx) => {
    if (!line.everyMonth) return
    if (line.amount === 0) {
      ctx.addIssue({ code: 'custom', path: ['amount'], message: 'Enter the amount each month' })
    }
    if (!line.date) {
      ctx.addIssue({ code: 'custom', path: ['date'], message: 'Choose the first date' })
    }
  })
export type MonthLineInput = z.input<typeof monthLineInputSchema>

/** Rows that can be renamed on the sheet: the others are edited on their own pages. */
export const renamableRowKinds = ['category', 'recurring', 'savings'] as const

export const monthRowRenameSchema = z
  .object({
    kind: z.enum(renamableRowKinds),
    sourceId: id,
    name: z
      .string()
      .trim()
      .min(1, 'Give the row a name')
      .max(40, 'Keep the name to 40 characters or fewer')
  })
  .strict()
export type MonthRowRename = z.input<typeof monthRowRenameSchema>

/** Hiding a category's row; it still shows in months with transactions. */
export const monthRowHideSchema = z.object({ categoryId: id, hidden: z.boolean() }).strict()
export type MonthRowHide = z.input<typeof monthRowHideSchema>

/** A section's category rows in their new order. */
export const monthRowOrderSchema = z
  .object({ type: z.enum(monthLineTypes), categoryIds: z.array(id).min(1).max(500) })
  .strict()
export type MonthRowOrder = z.input<typeof monthRowOrderSchema>
