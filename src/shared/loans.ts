import { z } from 'zod'
import { isIsoDate, type IsoDate } from './dates'
import { MAX_CENTS, type Cents } from './money'
import type { TransactionType } from './transactions'

export const loanKinds = ['lent', 'borrowed', 'bank_loan'] as const
export type LoanKind = (typeof loanKinds)[number]

/** Loans between people; bank loans with a schedule arrive in step 28. */
export const personalLoanKinds = ['lent', 'borrowed'] as const
export type PersonalLoanKind = (typeof personalLoanKinds)[number]

export const loanStatuses = ['active', 'paid_off', 'written_off'] as const
export type LoanStatus = (typeof loanStatuses)[number]

/** Money lent to someone, borrowed from someone, or a bank loan (PLAN.md §2). */
export interface Loan {
  id: number
  kind: LoanKind
  title: string
  counterparty: string
  principal: Cents
  interestRate: number | null
  startDate: IsoDate
  /** When it's expected to be paid back (personal loans). */
  dueDate: IsoDate | null
  installmentsCount: number | null
  paymentDay: number | null
  /** The account the money left or arrived in, and the default for repayments. */
  accountId: number | null
  /** Whether the start was recorded as a transaction (money leaving or arriving). */
  createDisbursementTx: boolean
  status: LoanStatus
  note: string | null
  /** Paid back so far. */
  repaid: Cents
  /** principal − repaid, never below zero; 0 for a loan written off. */
  outstanding: Cents
  repaymentCount: number
  lastRepaymentDate: IsoDate | null
}

/**
 * Which transaction types a loan uses. Lending: the money leaves your account (loan_out) and
 * comes back (loan_in). Borrowing: it arrives (loan_in) and you pay it back (loan_out).
 */
export function loanTypes(kind: LoanKind): {
  disbursement: TransactionType
  repayment: TransactionType
} {
  return kind === 'lent'
    ? { disbursement: 'loan_out', repayment: 'loan_in' }
    : { disbursement: 'loan_in', repayment: 'loan_out' }
}

/** "Loan to Marko" or "Loan from Ana", when no title is given. */
export const defaultLoanTitle = (kind: PersonalLoanKind, counterparty: string): string =>
  kind === 'lent' ? `Loan to ${counterparty}` : `Loan from ${counterparty}`

/** "Marko paid back" or "Paid back Ana": a repayment's title. */
export const repaymentTitle = (kind: LoanKind, counterparty: string): string =>
  kind === 'lent' ? `${counterparty} paid back` : `Paid back ${counterparty}`

/** Share of the loan paid back: 0 to 1. */
export const loanShare = (loan: Pick<Loan, 'principal' | 'repaid'>): number =>
  loan.principal > 0 ? Math.min(1, Math.max(0, loan.repaid / loan.principal)) : 0

/** Still owed and past the date it was expected back. */
export const isOverdue = (
  loan: Pick<Loan, 'status' | 'dueDate' | 'outstanding'>,
  today: IsoDate
): boolean =>
  loan.status === 'active' && loan.outstanding > 0 && loan.dueDate !== null && loan.dueDate < today

export const loanIdSchema = z.number().int().positive()

const amount = z
  .number()
  .int()
  .positive('Enter an amount above zero')
  .max(MAX_CENTS, 'That amount is too large')
const isoDate = z.string().refine(isIsoDate, 'Choose a date')
const note = z
  .string()
  .trim()
  .max(500, 'Keep the note to 500 characters or fewer')
  .transform((value) => value || null)
  .nullable()
const accountId = z.number({ error: 'Choose an account' }).int().positive('Choose an account')

/** Money lent to or borrowed from a person. */
export const personalLoanInputSchema = z
  .object({
    kind: z.enum(personalLoanKinds),
    counterparty: z
      .string()
      .trim()
      .min(1, 'Who is it with?')
      .max(60, 'Keep the name to 60 characters or fewer'),
    /** Empty means "Loan to …" / "Loan from …". */
    title: z.string().trim().max(80, 'Keep the title to 80 characters or fewer'),
    principal: amount,
    startDate: isoDate,
    dueDate: isoDate.nullable(),
    /** Record the money leaving (lent) or arriving (borrowed) as a transaction. */
    createDisbursementTx: z.boolean(),
    accountId: accountId.nullable(),
    note
  })
  .strict()
  .refine((loan) => loan.dueDate === null || loan.dueDate >= loan.startDate, {
    message: 'The due date can’t be before the start',
    path: ['dueDate']
  })
  .refine((loan) => !loan.createDisbursementTx || loan.accountId !== null, {
    message: 'Choose an account',
    path: ['accountId']
  })
export type PersonalLoanInput = z.input<typeof personalLoanInputSchema>

/** Money paid back on a loan, in either direction. */
export const repaymentInputSchema = z
  .object({
    loanId: loanIdSchema,
    amount,
    accountId,
    date: isoDate,
    note
  })
  .strict()
export type RepaymentInput = z.input<typeof repaymentInputSchema>

/**
 * Closing a loan with something still owed: either the rest is paid (a final repayment) or
 * it's let go (written off, no money moves).
 */
export const settleLoanInputSchema = z.discriminatedUnion('how', [
  z.object({ how: z.literal('repaid'), accountId, date: isoDate }).strict(),
  z.object({ how: z.literal('forgiven') }).strict()
])
export type SettleLoanInput = z.input<typeof settleLoanInputSchema>
