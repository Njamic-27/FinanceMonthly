import { z } from 'zod'
import type { Account } from './accounts'
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
  /** The monthly summary of a Month sheet row: what its individual transactions don't hold. */
  isMonthTotal: boolean
  note: string | null
  createdAt: string
  updatedAt: string
}

export const transactionIdSchema = z.number().int().positive()

const accountId = (message: string): z.ZodNumber =>
  z.number({ error: message }).int().positive(message)

const common = {
  /** Empty means a default: the category name, or for transfers e.g. "Cash withdrawal". */
  title: z.string().trim().max(80, 'Keep the title to 80 characters or fewer'),
  amount: z
    .number()
    .int()
    .positive('Enter an amount above zero')
    .max(MAX_CENTS, 'That amount is too large'),
  date: z.string().refine(isIsoDate, 'Choose a date'),
  accountId: accountId('Choose an account'),
  note: z
    .string()
    .trim()
    .max(500, 'Keep the note to 500 characters or fewer')
    .transform((note) => note || null)
    .nullable()
}
const categoryId = z.number({ error: 'Choose a category' }).int().positive('Choose a category')

/** What the Add transaction dialog edits: income, expenses and transfers between accounts. */
export const transactionInputSchema = z.discriminatedUnion('type', [
  z.object({ ...common, type: z.literal('income'), categoryId }).strict(),
  z.object({ ...common, type: z.literal('expense'), categoryId }).strict(),
  z
    .object({
      ...common,
      type: z.literal('transfer'),
      /** Where the money goes; `accountId` is where it comes from. */
      toAccountId: accountId('Choose where the money goes')
    })
    .strict()
    .refine((t) => t.toAccountId !== t.accountId, {
      message: 'Choose two different accounts',
      path: ['toAccountId']
    })
])
export type TransactionInput = z.input<typeof transactionInputSchema>

/** The transaction types the dialog creates and edits. */
export type EditableType = TransactionInput['type']

/** The type filter on the Transactions screen. */
export const transactionKinds = ['income', 'expense', 'transfer'] as const
export type TransactionKind = (typeof transactionKinds)[number]

const isoDate = z.string().refine(isIsoDate, 'Choose a date')

/** Filters and paging for the transaction list. Results are newest first. */
export const transactionQuerySchema = z
  .object({
    /** Matches title, note or category name, ignoring case and diacritics. */
    search: z.string().trim().max(100).optional(),
    /** Also match this exact amount (the renderer parses the search text with the locale). */
    amount: z.number().int().positive().max(MAX_CENTS).optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
    /** Transfers match on either side. */
    accountId: transactionIdSchema.optional(),
    categoryId: transactionIdSchema.optional(),
    kind: z.enum(transactionKinds).optional(),
    /** Continue after this row (the last one of the previous page). */
    after: z.object({ date: isoDate, id: transactionIdSchema }).optional(),
    limit: z.number().int().min(1).max(500).optional()
  })
  .strict()
export type TransactionQuery = z.input<typeof transactionQuerySchema>

export interface DayTotal {
  date: IsoDate
  income: Cents
  expenses: Cents
}

export interface TransactionPage {
  items: Transaction[]
  /** Pass as `after` to get the next page; null when there is none. */
  next: { date: IsoDate; id: number } | null
  /** Income and expense totals for each day on this page, over all of that day's matches. */
  dayTotals: DayTotal[]
  /** Totals over everything matching the filters; only on the first page. */
  summary: { count: number; income: Cents; expenses: Cents } | null
}

/** The title an untitled transfer gets: "Mastercard payment", "Cash withdrawal", … */
export function defaultTransferTitle(
  from: Pick<Account, 'type'>,
  to: Pick<Account, 'name' | 'type'>
): string {
  if (to.type === 'credit') return `${to.name} payment`
  if (from.type !== 'cash' && to.type === 'cash') return 'Cash withdrawal'
  if (from.type === 'cash' && to.type !== 'cash') return 'Cash deposit'
  return `Transfer to ${to.name}`
}
