import { z } from 'zod'
import { isIsoDate, type IsoDate } from './dates'
import { MAX_CENTS, type Cents } from './money'

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
  endDate: IsoDate | null
  /** The first occurrence not posted yet; earlier ones are never posted. */
  nextDueDate: IsoDate
  /** Post automatically when due, or ask first. */
  autoPost: boolean
  reminderDaysBefore: number | null
  url: string | null
  note: string | null
  isActive: boolean
}

const isoDate = z.string().refine(isIsoDate, 'Choose a date')

/** Creating a recurring item. Editing, posting and the full form arrive in steps 19–21. */
export const recurringItemInputSchema = z
  .object({
    kind: z.enum(recurringKinds),
    title: z
      .string()
      .trim()
      .min(1, 'Give it a name')
      .max(80, 'Keep the name to 80 characters or fewer'),
    amount: z
      .number()
      .int()
      .positive('Enter an amount above zero')
      .max(MAX_CENTS, 'That amount is too large'),
    accountId: z.number({ error: 'Choose an account' }).int().positive('Choose an account'),
    categoryId: z.number({ error: 'Choose a category' }).int().positive('Choose a category'),
    frequency: z.enum(frequencies),
    interval: z.number().int().min(1).max(12),
    anchorDate: isoDate,
    nextDueDate: isoDate,
    autoPost: z.boolean(),
    reminderDaysBefore: z.number().int().min(0).max(30).nullable()
  })
  .strict()
  .refine((item) => item.nextDueDate >= item.anchorDate, {
    message: 'The next date can’t be before the first one',
    path: ['nextDueDate']
  })
export type RecurringItemInput = z.input<typeof recurringItemInputSchema>
