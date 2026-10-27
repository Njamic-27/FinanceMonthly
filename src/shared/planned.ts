import { z } from 'zod'
import { isIsoDate, type DateRange, type IsoDate } from './dates'
import type { Cents } from './money'

/** Where a planned item comes from. Installment plans and loan installments join later. */
export type PlannedSource = 'recurring'

/** The money kind, for colours and the sign: income adds to the balance, the rest takes away. */
export type PlannedGroup = 'income' | 'expense' | 'savings' | 'loan'

/**
 * A payment expected on a date that no transaction settles yet: recurring income, a bill or
 * a subscription (PLAN.md §4, planned items). The Calendar, reminders and projections all
 * read these, so they always agree.
 */
export interface PlannedItem {
  source: PlannedSource
  /** The recurring item's id. */
  sourceId: number
  /** The day it falls due; settling it records this as the transaction's planned date. */
  date: IsoDate
  title: string
  amount: Cents
  group: PlannedGroup
  accountId: number
  categoryId: number | null
  /** Due before today and still not settled. */
  overdue: boolean
}

/** `amount` with the sign it has on the balance. */
export const signedPlanned = (item: Pick<PlannedItem, 'amount' | 'group'>): Cents =>
  item.group === 'income' ? item.amount : -item.amount

/** A planned payment coming up soon, with its reminder. */
export interface UpcomingPayment {
  planned: PlannedItem
  /** Days before the due date the reminder goes off; null for no reminder. */
  reminderDaysBefore: number | null
  /** The day the reminder goes off, or null. */
  remindOn: IsoDate | null
  /** Whether the reminder notification has been shown. */
  notified: boolean
}

/**
 * A credit card's payment due date on the Calendar. Only a marker: paying a card moves money
 * between your own accounts, so it never counts toward income, spending or the balance.
 */
export interface CardDueMarker {
  accountId: number
  /** The card's name. */
  name: string
  date: IsoDate
  /** Left to pay on the statement this pays, once that statement has closed; else null. */
  amount: Cents | null
}

/** One day of the Calendar grid: what actually happened that day. */
export interface CalendarDay {
  date: IsoDate
  income: Cents
  expenses: Cents
  /** Savings deposits and withdrawals together, for the savings dot. */
  savings: Cents
  /** Loan movements in and out together, for the loan dot. */
  loans: Cents
  /** Transactions of every type, transfers included. */
  count: number
}

export interface CalendarSummary {
  /** Recorded in the month. */
  income: Cents
  expenses: Cents
  /** Planned in the month and not settled yet, overdue ones included. */
  plannedIncome: Cents
  plannedExpenses: Cents
  /** Planned items in the month that are overdue. */
  overdue: number
  /**
   * Total balance at the end of the month. For a past month, what it actually was; for the
   * current and later months, today's balance with everything planned up to the month's end.
   */
  endingBalance: Cents
  projected: boolean
}

export interface CalendarMonth {
  /** The month shown. */
  month: DateRange
  /** Whole weeks covering the month, starting on the first day of the week from Settings. */
  grid: DateRange
  /** Every day of `grid`, in order. */
  days: CalendarDay[]
  /** Planned items due within `grid`, by date. */
  planned: PlannedItem[]
  /** Credit card payment due dates within `grid`, by date. Not part of `summary`. */
  cardDues: CardDueMarker[]
  summary: CalendarSummary
}

/** How far ahead the Calendar goes, in months after the current one. */
export const CALENDAR_MONTHS_AHEAD = 24

/** Any day in the month to show. */
export const calendarQuerySchema = z
  .object({ month: z.string().refine(isIsoDate, 'Choose a date') })
  .strict()
export type CalendarQuery = z.input<typeof calendarQuerySchema>
