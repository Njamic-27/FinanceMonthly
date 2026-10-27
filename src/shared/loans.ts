import { z } from 'zod'
import { isIsoDate, type IsoDate } from './dates'
import { MAX_CENTS, type Cents } from './money'
import type { TransactionType } from './transactions'

export const loanKinds = ['lent', 'borrowed', 'bank_loan'] as const
export type LoanKind = (typeof loanKinds)[number]

/** Loans between people, without a schedule. */
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
  /**
   * Bank loans: each installment is marked paid from `accountId` on its due date, as the bank
   * takes it. When off, you mark each one paid, with a reminder 3 days before.
   */
  autoPay: boolean
  status: LoanStatus
  note: string | null
  /** Paid back so far. */
  repaid: Cents
  /** principal − repaid, never below zero; 0 for a loan written off. */
  outstanding: Cents
  repaymentCount: number
  lastRepaymentDate: IsoDate | null
  /** Bank loans only: the schedule at a glance. */
  bank: BankLoanSummary | null
}

/** A bank loan's schedule at a glance. */
export interface BankLoanSummary {
  /** The regular installment (the last one may differ by a few cents). */
  monthlyPayment: Cents
  totalInterest: Cents
  interestPaid: Cents
  paidCount: number
  /** The earliest installment not paid yet. */
  next: Pick<LoanInstallment, 'id' | 'seq' | 'dueDate' | 'amount'> | null
  /** Unpaid installments due before today. */
  overdueCount: number
  firstPaymentDate: IsoDate
  /** The last installment's date. */
  payoffDate: IsoDate
}

/** One installment of a bank loan's schedule; paid once a transaction links to it. */
export interface LoanInstallment {
  id: number
  loanId: number
  seq: number
  dueDate: IsoDate
  amount: Cents
  principalPart: Cents
  interestPart: Cents
  /** Principal still owed after it. */
  balance: Cents
  /** The payment, once made. */
  transactionId: number | null
  paidDate: IsoDate | null
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

/** A loan from a bank, repaid in equal monthly installments (annuity). */
export const bankLoanInputSchema = z
  .object({
    /** The bank. */
    counterparty: z
      .string()
      .trim()
      .min(1, 'Which bank is it with?')
      .max(60, 'Keep the name to 60 characters or fewer'),
    /** Empty means "Loan from <bank>". */
    title: z.string().trim().max(80, 'Keep the title to 80 characters or fewer'),
    principal: amount,
    /** Annual interest, in percent. */
    interestRate: z
      .number({ error: 'Enter the interest rate, or 0' })
      .min(0, 'Enter the interest rate, or 0')
      .max(100, 'Enter a yearly rate below 100%'),
    installmentsCount: z
      .number({ error: 'Enter how many monthly installments' })
      .int('Enter a whole number of installments')
      .min(1, 'Enter at least 1 installment')
      .max(600, 'Enter 600 installments or fewer'),
    /** When the money was paid out. */
    startDate: isoDate,
    /** Then one installment a month on the same day. */
    firstPaymentDate: isoDate,
    /** Record the loan money arriving in `accountId` on the start date. */
    createDisbursementTx: z.boolean(),
    /** Mark each installment paid on its due date (on by default). */
    autoPay: z.boolean().default(true),
    /** Where installments are paid from. */
    accountId,
    note
  })
  .strict()
  .refine((loan) => loan.firstPaymentDate > loan.startDate, {
    message: 'The first installment comes after the loan starts',
    path: ['firstPaymentDate']
  })
export type BankLoanInput = z.input<typeof bankLoanInputSchema>

/** Paying one installment of a bank loan. */
export const payInstallmentInputSchema = z.object({ accountId, date: isoDate }).strict()
export type PayInstallmentInput = z.input<typeof payInstallmentInputSchema>

/** Days before each installment that a bank loan paid by hand reminds you. */
export const LOAN_REMINDER_DAYS = 3

/** "Loan from Erste", when a bank loan has no title. */
export const defaultBankLoanTitle = (bank: string): string => `Loan from ${bank}`
