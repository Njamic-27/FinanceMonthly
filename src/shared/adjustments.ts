import { z } from 'zod'
import { isIsoDate } from './dates'
import { MAX_CENTS, type Cents } from './money'
import type { Transaction, TransactionType } from './transactions'

// Balance adjustments (PLAN.md §2, step 39). When an account's real balance differs from the
// app's, typing the real one adds an adjustment for the difference: in or out of the account,
// never counted as income or spending, but part of every balance.

export const ADJUSTMENT_TITLE = 'Balance adjustment'

export const isAdjustment = (type: TransactionType): boolean =>
  type === 'adjustment_in' || type === 'adjustment_out'

/** An adjustment's amount with its sign on the account: + money in, − money out. */
export const adjustmentAmount = (tx: Pick<Transaction, 'type' | 'amount'>): Cents =>
  tx.type === 'adjustment_in' ? tx.amount : -tx.amount

const signedAmount = z
  .number({ error: 'Enter an amount' })
  .int()
  .min(-MAX_CENTS, 'That amount is too large')
  .max(MAX_CENTS, 'That amount is too large')

/**
 * The real balances you typed, one per account. Credit cards owe money, so theirs are
 * negative, as everywhere in the ledger.
 */
export const balanceTargetsSchema = z
  .array(
    z
      .object({
        accountId: z.number().int().positive(),
        balance: signedAmount
      })
      .strict()
  )
  .min(1)
export type BalanceTarget = z.input<typeof balanceTargetsSchema>[number]

/** Changing an adjustment: its signed amount (+ in, − out), date and note. */
export const adjustmentUpdateSchema = z
  .object({
    amount: signedAmount.refine((n) => n !== 0, 'Enter an amount other than zero'),
    date: z.string().refine(isIsoDate, 'Choose a date'),
    note: z
      .string()
      .trim()
      .max(500, 'Keep the note to 500 characters or fewer')
      .transform((note) => note || null)
      .nullable()
  })
  .strict()
export type AdjustmentUpdate = z.input<typeof adjustmentUpdateSchema>
