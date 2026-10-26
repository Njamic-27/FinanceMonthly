import { z } from 'zod'
import { isIsoDate, type IsoDate } from './dates'
import { MAX_CENTS, type Cents } from './money'
import { occurrences } from './recurrence'

export const recurringKinds = ['income', 'expense', 'subscription'] as const
export type RecurringKind = (typeof recurringKinds)[number]

export const frequencies = ['weekly', 'monthly', 'yearly'] as const
export type Frequency = (typeof frequencies)[number]

/** Monthly income, a regular bill or a subscription (PLAN.md §2). */
export interface RecurringItem {
  id: number
  kind: RecurringKind
  title: string
  amount: Cents
  accountId: number
  categoryId: number
  frequency: Frequency
  /** Every N periods. */
  interval: number
  /** Fixes the schedule's day: occurrences fall on this date's day of the month (or weekday). */
  anchorDate: IsoDate
  /** The last day it can fall due, inclusive. */
  endDate: IsoDate | null
  /**
   * The first occurrence not posted or skipped yet; earlier ones are never posted. After the
   * last occurrence before `endDate` it moves past `endDate` (see `hasEnded`).
   */
  nextDueDate: IsoDate
  /** Post automatically when due, or ask first. */
  autoPost: boolean
  reminderDaysBefore: number | null
  url: string | null
  note: string | null
  isActive: boolean
  /** Transactions posted from it. */
  postedCount: number
}

/** Income items post income; expenses and subscriptions post expenses. */
export const postedType = (kind: RecurringKind): 'income' | 'expense' =>
  kind === 'income' ? 'income' : 'expense'

/** Every occurrence up to the end date is posted or skipped: nothing more falls due. */
export function hasEnded(item: Pick<RecurringItem, 'endDate' | 'nextDueDate'>): boolean {
  return item.endDate !== null && item.nextDueDate > item.endDate
}

/** How many times a year the schedule falls due, on average (52.18 for weekly). */
function perYear(item: Pick<RecurringItem, 'frequency' | 'interval'>): number {
  const times = { weekly: 365.2425 / 7, monthly: 12, yearly: 1 }[item.frequency]
  return times / item.interval
}

/** What it costs (or brings in) over a year, in whole cents. */
export function yearlyCost(item: Pick<RecurringItem, 'amount' | 'frequency' | 'interval'>): Cents {
  return Math.round(item.amount * perYear(item))
}

/** What it costs (or brings in) in an average month, in whole cents. */
export function monthlyCost(item: Pick<RecurringItem, 'amount' | 'frequency' | 'interval'>): Cents {
  return Math.round((item.amount * perYear(item)) / 12)
}

/** Choices for `reminderDaysBefore`: null is off, 0 is on the day. */
export const reminderChoices = [null, 0, 1, 2, 3, 7] as const

export const recurringIdSchema = z.number().int().positive()

const isoDate = z.string().refine(isIsoDate, 'Choose a date')
const amount = z
  .number()
  .int()
  .positive('Enter an amount above zero')
  .max(MAX_CENTS, 'That amount is too large')
const accountId = z.number({ error: 'Choose an account' }).int().positive('Choose an account')

/** Creating or editing a recurring item. */
export const recurringItemInputSchema = z
  .object({
    kind: z.enum(recurringKinds),
    title: z
      .string()
      .trim()
      .min(1, 'Give it a name')
      .max(80, 'Keep the name to 80 characters or fewer'),
    amount,
    accountId,
    categoryId: z.number({ error: 'Choose a category' }).int().positive('Choose a category'),
    frequency: z.enum(frequencies),
    interval: z.number().int().min(1, 'Enter 1 or more').max(12, 'Enter 12 or fewer'),
    anchorDate: isoDate,
    nextDueDate: isoDate,
    endDate: isoDate.nullable().default(null),
    autoPost: z.boolean(),
    reminderDaysBefore: z.number().int().min(0).max(30).nullable(),
    /** Where to manage or cancel it; "netflix.com" is saved as "https://netflix.com". */
    url: z
      .string()
      .trim()
      .max(300, 'Keep the address to 300 characters or fewer')
      // Only a bare address gets a scheme; "javascript:" or "file:" ones stay as typed and fail.
      .transform(
        (url) => (url && !/^[a-z][a-z\d+.-]*:/i.test(url) ? `https://${url}` : url) || null
      )
      .refine((url) => url === null || /^https?:\/\/[^\s/$.?#][^\s]*\.[^\s]+$/i.test(url), {
        message: 'Enter a web address like netflix.com'
      })
      .nullable()
      .default(null),
    note: z
      .string()
      .trim()
      .max(500, 'Keep the note to 500 characters or fewer')
      .transform((note) => note || null)
      .nullable()
      .default(null)
  })
  .strict()
  .refine((item) => item.nextDueDate >= item.anchorDate, {
    message: 'The next date can’t be before the first one',
    path: ['nextDueDate']
  })
  .refine(
    (item) =>
      item.nextDueDate < item.anchorDate ||
      occurrences(item, item.nextDueDate, item.nextDueDate).length === 1,
    { message: 'The next date doesn’t fall on this schedule', path: ['nextDueDate'] }
  )
  .refine((item) => item.endDate === null || item.endDate >= item.nextDueDate, {
    message: 'The end date can’t be before the next date',
    path: ['endDate']
  })
export type RecurringItemInput = z.input<typeof recurringItemInputSchema>

/** An occurrence that has fallen due and is not posted yet. */
export interface DueOccurrence {
  item: RecurringItem
  plannedDate: IsoDate
  /**
   * Why it could not be posted as it stands, e.g. its account is archived. Items that post
   * automatically wait here only because of such a problem.
   */
  problem: string | null
}

/** Whether `url` is a web address the app may open in the browser. */
export const isWebAddress = (url: string): boolean => /^https?:\/\//i.test(url)

/** Confirming a due or planned occurrence: posts it with these values. */
export const postOccurrenceSchema = z
  .object({
    itemId: recurringIdSchema,
    plannedDate: isoDate,
    /** The day it was actually paid; may differ from the planned date. */
    date: isoDate,
    amount,
    accountId
  })
  .strict()
export type PostOccurrenceInput = z.input<typeof postOccurrenceSchema>
