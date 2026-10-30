import { z } from 'zod'
import { MAX_CENTS, type Cents } from './money'
import { isIsoDate, type IsoDate } from './dates'
import { paletteColors, type PaletteColor } from './palette'

export const accountTypes = ['debit', 'credit', 'cash'] as const
export type AccountType = (typeof accountTypes)[number]

export interface Account {
  id: number
  name: string
  type: AccountType
  /**
   * Balance on the opening date. For credit cards it's the debt then, as a negative number.
   */
  openingBalance: Cents
  openingDate: IsoDate
  /** Credit cards only. */
  creditLimit: Cents | null
  statementDay: number | null
  paymentDueDay: number | null
  /** Credit cards: the debit account the bill is paid from (PLAN.md step 48). */
  payFromAccountId: number | null
  color: PaletteColor
  isArchived: boolean
  sortOrder: number
  /**
   * Opening balance plus every transaction from the opening date up to today. Credit cards
   * are ≤ 0 while you owe money on them.
   */
  balance: Cents
  /** Credit cards only: limit + balance − `reserved`. */
  available: Cents | null
  /** Credit cards only: installments bought on the card and not charged yet. */
  reserved: Cents | null
  /** Transactions, recurring items, loans and installment plans that use the account. */
  usageCount: number
}

export const accountIdSchema = z.number().int().positive()

const cents = z.number().int().min(-MAX_CENTS).max(MAX_CENTS)
const dayOfMonth = z
  .number()
  .int()
  .min(1, 'Pick a day from 1 to 31')
  .max(31, 'Pick a day from 1 to 31')

const common = {
  name: z
    .string()
    .trim()
    .min(1, 'Give the account a name')
    .max(40, 'Keep the name to 40 characters or fewer'),
  openingDate: z.string().refine(isIsoDate, 'Enter a date'),
  color: z.enum(paletteColors)
}

/** Everything the account form edits. Credit-card fields exist only on credit cards. */
export const accountInputSchema = z.discriminatedUnion('type', [
  z.object({ ...common, type: z.literal('debit'), openingBalance: cents }).strict(),
  z
    .object({
      ...common,
      type: z.literal('cash'),
      openingBalance: cents.min(0, 'Cash can’t start below zero')
    })
    .strict(),
  z
    .object({
      ...common,
      type: z.literal('credit'),
      openingBalance: cents.max(0, 'Enter what you owe on the card'),
      creditLimit: cents.positive('Enter the card’s credit limit'),
      statementDay: dayOfMonth.nullable(),
      paymentDueDay: dayOfMonth.nullable(),
      /** Where the bill is paid from; the first debit account when left out. */
      payFromAccountId: z.number().int().positive().nullable().optional()
    })
    .strict()
])
export type AccountInput = z.infer<typeof accountInputSchema>
