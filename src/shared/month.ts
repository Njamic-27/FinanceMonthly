import { z } from 'zod'
import { endOfMonth, isIsoDate, type DateRange, type IsoDate } from './dates'
import { MAX_CENTS, type Cents } from './money'
import type { CalendarSummary, PlannedItem } from './planned'
import type { Transaction } from './transactions'
import { frequencies } from './recurring'

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

/** A row's key on the sheet, as `kind:sourceId` ("category:4", "loan:2"). */
export const monthRowKey = (row: { kind: string; sourceId: number }): string =>
  `${row.kind}:${row.sourceId}`

/**
 * Month on `month` with a row's panel open (PLAN.md step 47): where reminders and planned
 * payments send you, so everyday things are done on Month.
 */
export const monthRowPath = (month: MonthKey, row: { kind: string; sourceId: number }): string =>
  `/?${new URLSearchParams({ month, row: monthRowKey(row) })}`

/** A planned payment's row on Month: its item's, loan's or purchase's, where it counts. */
export function plannedRowPath(planned: PlannedItem): string {
  const month = monthKeyOf(planned.countsOn)
  switch (planned.source) {
    case 'recurring':
      return monthRowPath(month, { kind: 'recurring', sourceId: planned.sourceId })
    case 'installment_plan':
      return monthRowPath(month, { kind: 'installment_plan', sourceId: planned.sourceId })
    case 'loan_installment':
      return planned.loanId
        ? monthRowPath(month, { kind: 'loan', sourceId: planned.loanId })
        : `/?${new URLSearchParams({ month })}`
  }
}

/**
 * The date a monthly summary transaction gets: today in the current month, otherwise the
 * month's last day.
 */
export function summaryDate(month: MonthKey, today: IsoDate): IsoDate {
  return monthKeyOf(today) === month ? today : monthRange(month).end
}

/**
 * The sheet's sections (PLAN.md step 49): Income, then what money out is made of —
 * Subscriptions, Bills and Everyday (by category group; a subscription item always
 * Subscriptions), Loans and Savings — and Credit cards, each card's bill this month, shown but
 * not counted (its purchases are already in their groups).
 */
export const monthSectionKeys = [
  'income',
  'subscriptions',
  'bills',
  'everyday',
  'loans',
  'savings',
  'cards'
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
  /**
   * Card payment rows: the month's spending on the card, recorded and planned, less refunds.
   * With card spending counted when the card is paid, that's what its bill brings this month.
   */
  onBill?: Cents
  /**
   * Of this row, what's on credit cards (recorded and planned), by card: card purchases count
   * in the month their bill is paid and are marked with their card.
   */
  byCard?: { accountId: number; amount: Cents }[]
}

/**
 * The month's totals on Month and in the Calendar (PLAN.md §2, step 49). Money out is what
 * leaves your debit accounts and cash: spending (card purchases on the bill they count on),
 * loan payments (less money borrowed) and savings deposits (less withdrawals). Planned amounts
 * count from the current month on.
 */
export interface MonthTotals {
  moneyIn: Cents
  moneyOut: Cents
  /** Money in less money out. */
  net: Cents
  /** Money out's parts. */
  spending: Cents
  loans: Cents
  savings: Cents
  /** The net of what's recorded so far, without anything planned. */
  recordedNet: Cents
  /** Planned amounts are included (the current and later months, when there are any). */
  withPlanned: boolean
}

/** What money out is grouped into, by the account it left from (PLAN.md step 49). */
export type MoneyOutGroup = 'subscriptions' | 'bills' | 'everyday' | 'loans' | 'savings' | 'card'

/**
 * One line of money out by payment method: what a debit account or cash paid for one group,
 * or a card's spending ("Credit card (Mastercard)") under the account its bill is paid from.
 */
export interface MoneyOutLine {
  /** A debit account or cash (a card's bill falls back to the card when there are none). */
  accountId: number
  group: MoneyOutGroup
  /** The card, for `card` lines. */
  cardId: number | null
  recorded: Cents
  /** Still to come, counted from the current month on. */
  planned: Cents
  /** Recorded transactions. */
  count: number
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
  /** The month's ending balance, overdue count and planned items, as the Calendar has them. */
  summary: CalendarSummary
  totals: MonthTotals
  /** Money out by the account it left from; adds up to `totals.moneyOut`. */
  byAccount: MoneyOutLine[]
}

const monthKey = z.string().refine(isMonthKey, 'Choose a month')

export const monthSheetQuerySchema = z.object({ month: monthKey }).strict()

/** One money-out line, to list what it's made of (PLAN.md step 50). */
export const moneyOutQuerySchema = z
  .object({
    month: monthKey,
    accountId: z.number().int().positive(),
    group: z.enum(['subscriptions', 'bills', 'everyday', 'loans', 'savings', 'card']),
    cardId: z.number().int().positive().nullable()
  })
  .strict()
export type MoneyOutQuery = z.input<typeof moneyOutQuerySchema>

/** A payment still to come on a money-out line; a savings plan has no date. */
export interface MoneyOutPlanned {
  title: string
  date: IsoDate | null
  amount: Cents
}

export interface MoneyOutItems {
  transactions: Transaction[]
  planned: MoneyOutPlanned[]
}
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

/** How often a recurring line repeats: every week, every N months or every year. */
export const lineRepeatSchema = z
  .object({ frequency: z.enum(frequencies), interval: z.number().int().min(1).max(12) })
  .strict()
export type LineRepeat = z.infer<typeof lineRepeatSchema>

/**
 * "+" under Income or Expenses: something in a category, picked or created by name (an
 * existing one is reused, an archived one restored). One-time adds a transaction on `date`
 * and puts the category on the sheet; with `repeat` it's a recurring item from `date` on.
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
    /** A recurring item's own name, e.g. "Netflix" in Subscriptions; the category's if empty. */
    title: z.string().trim().max(80, 'Keep the name to 80 characters or fewer').optional(),
    /** One-time: 0 only puts the row on the sheet. Recurring: the amount each time. */
    amount: z
      .number({ error: 'Enter an amount' })
      .int()
      .min(0, 'Enter 0 or more')
      .max(MAX_CENTS, 'That amount is too large'),
    accountId: z.number({ error: 'Choose an account' }).int().positive('Choose an account'),
    /** The transaction's date, or the first payment's. */
    date: z.string().refine(isIsoDate, 'Choose a date'),
    repeat: lineRepeatSchema.nullable()
  })
  .strict()
  .superRefine((line, ctx) => {
    if (line.repeat && line.amount === 0) {
      ctx.addIssue({ code: 'custom', path: ['amount'], message: 'Enter the amount each time' })
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
