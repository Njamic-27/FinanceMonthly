import { z } from 'zod'
import { isIsoDate, type IsoDate } from './dates'
import { MAX_CENTS, type Cents } from './money'

export const transactionTypes = [
  'income',
  'expense',
  'transfer',
  'savings_deposit',
  'savings_withdrawal',
  'loan_out',
  'loan_in'
] as const
export type TransactionType = (typeof transactionTypes)[number]

/** A row of the ledger. `amount` is always positive; the type gives the sign (PLAN.md §2). */
export interface Transaction {
  id: number
  date: IsoDate
  title: string
  amount: Cents
  type: TransactionType
  accountId: number
  toAccountId: number | null
  categoryId: number | null
  recurringItemId: number | null
  savingsGoalId: number | null
  loanId: number | null
  loanInstallmentId: number | null
  installmentPlanId: number | null
  plannedDate: IsoDate | null
  note: string | null
  createdAt: string
  updatedAt: string
}

export const transactionIdSchema = z.number().int().positive()

/** What the Add transaction dialog edits: income and expenses. Transfers arrive in step 12. */
export const transactionInputSchema = z
  .object({
    type: z.enum(['income', 'expense']),
    /** Empty means "use the category name". */
    title: z.string().trim().max(80, 'Keep the title to 80 characters or fewer'),
    amount: z
      .number()
      .int()
      .positive('Enter an amount above zero')
      .max(MAX_CENTS, 'That amount is too large'),
    date: z.string().refine(isIsoDate, 'Choose a date'),
    accountId: z.number({ error: 'Choose an account' }).int().positive('Choose an account'),
    categoryId: z.number({ error: 'Choose a category' }).int().positive('Choose a category'),
    note: z
      .string()
      .trim()
      .max(500, 'Keep the note to 500 characters or fewer')
      .transform((note) => note || null)
      .nullable()
  })
  .strict()
export type TransactionInput = z.input<typeof transactionInputSchema>
