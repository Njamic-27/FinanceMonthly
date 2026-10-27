import { z } from 'zod'
import { addMonths, isIsoDate, type IsoDate } from './dates'
import { MAX_CENTS, type Cents } from './money'

/** How many installments a card purchase can be split into. */
export const MIN_INSTALLMENTS = 2
export const MAX_INSTALLMENTS = 60

/**
 * Splits `total` into `count` installments in whole cents: each is `floor(total / count)` and
 * the last one takes what's left over (1,000.00 / 3 = 333.33, 333.33, 333.34).
 */
export function splitInstallments(total: Cents, count: number): Cents[] {
  const rate = Math.floor(total / count)
  return Array.from({ length: count }, (_, i) =>
    i === count - 1 ? total - rate * (count - 1) : rate
  )
}

export interface Installment {
  /** 1 to count. */
  seq: number
  date: IsoDate
  amount: Cents
}

/**
 * Every installment of a plan: the first on `firstDate`, then one a month on the same day,
 * counted from the first so a 31st comes back after a short month (31 Jan, 28 Feb, 31 Mar).
 */
export function installmentSchedule(
  total: Cents,
  count: number,
  firstDate: IsoDate
): Installment[] {
  return splitInstallments(total, count).map((amount, i) => ({
    seq: i + 1,
    date: addMonths(firstDate, i),
    amount
  }))
}

/** The title each installment's transaction gets: "Laptop (2/5)". */
export const installmentTitle = (title: string, seq: number, count: number): string =>
  `${title} (${seq}/${count})`

/** A credit card purchase paid in monthly installments (PLAN.md §2, installment_plans). */
export interface InstallmentPlan {
  id: number
  accountId: number
  title: string
  categoryId: number
  totalAmount: Cents
  count: number
  firstDate: IsoDate
  note: string | null
  /** The regular installment; the last one may be a few cents more. */
  installment: Cents
  lastInstallment: Cents
  /** Installments already charged to the card. */
  postedCount: number
  /** Still to be charged: it reserves that much of the card's limit. */
  remaining: Cents
  /** The next installment's date, or null once all are charged. */
  nextDate: IsoDate | null
  lastDate: IsoDate
}

export const installmentPlanIdSchema = z.number().int().positive()

/** Buying something on a credit card in installments, from the Add transaction dialog. */
export const installmentPlanInputSchema = z
  .object({
    accountId: z.number({ error: 'Choose a card' }).int().positive('Choose a card'),
    /** Empty means the category's name, as for any expense. */
    title: z.string().trim().max(80, 'Keep the title to 80 characters or fewer'),
    categoryId: z.number({ error: 'Choose a category' }).int().positive('Choose a category'),
    totalAmount: z
      .number()
      .int()
      .positive('Enter an amount above zero')
      .max(MAX_CENTS, 'That amount is too large'),
    count: z
      .number({ error: `Enter ${MIN_INSTALLMENTS} to ${MAX_INSTALLMENTS} installments` })
      .int(`Enter a whole number of installments`)
      .min(MIN_INSTALLMENTS, `Enter ${MIN_INSTALLMENTS} to ${MAX_INSTALLMENTS} installments`)
      .max(MAX_INSTALLMENTS, `Enter ${MIN_INSTALLMENTS} to ${MAX_INSTALLMENTS} installments`),
    firstDate: z.string().refine(isIsoDate, 'Choose a date'),
    note: z
      .string()
      .trim()
      .max(500, 'Keep the note to 500 characters or fewer')
      .transform((note) => note || null)
      .nullable()
  })
  .strict()
  .refine((plan) => plan.totalAmount >= plan.count, {
    message: 'Each installment needs to be at least one cent',
    path: ['count']
  })
export type InstallmentPlanInput = z.input<typeof installmentPlanInputSchema>
