import { z } from 'zod'
import { addMonths, dayOfMonth, isIsoDate, startOfMonth, type IsoDate } from './dates'
import type { Cents } from './money'

/**
 * Where a credit card stands in its monthly cycle. The statement closes on `statementDay`
 * each month and is paid by the next `paymentDueDay` after it; both move to the month's last
 * day in shorter months (a 31st closes on 30 November).
 */
export interface CardCycle {
  /** The latest statement closing on or before today. */
  lastStatement: IsoDate | null
  /** The first statement closing after today. */
  nextStatement: IsoDate | null
  /** The next payment due date, today included. */
  dueDate: IsoDate | null
  /** The statement `dueDate` pays: closed already (≤ today) or still to close. */
  dueStatement: IsoDate | null
}

/** Day `day` of the month `n` months after the one containing `date`. */
const dayIn = (date: IsoDate, n: number, day: number): IsoDate =>
  dayOfMonth(addMonths(startOfMonth(date), n), day)

/** The first `day` of a month strictly after `date`. */
function dayAfter(date: IsoDate, day: number): IsoDate {
  const sameMonth = dayIn(date, 0, day)
  return sameMonth > date ? sameMonth : dayIn(date, 1, day)
}

/**
 * The due date of the card bill a purchase on `date` goes on: the first statement on or after
 * `date` (a purchase on the statement day is on that statement), then the first payment due
 * day after that statement. Purchase 20 Oct, statement day 25, due day 15 → 15 Nov.
 */
export function billDueDate(date: IsoDate, statementDay: number, paymentDueDay: number): IsoDate {
  const sameMonth = dayIn(date, 0, statementDay)
  const statement = sameMonth >= date ? sameMonth : dayIn(date, 1, statementDay)
  return dayAfter(statement, paymentDueDay)
}

/**
 * The day income or spending on an account counts (PLAN.md §2, steps 42 and 48): on a credit
 * card with both its days set, the due date of the bill it's on; otherwise the day itself.
 * Transactions store this as `counts_on`.
 */
export function countedDate(
  date: IsoDate,
  account: { type: string; statementDay: number | null; paymentDueDay: number | null }
): IsoDate {
  if (account.type !== 'credit') return date
  if (account.statementDay === null || account.paymentDueDay === null) return date
  return billDueDate(date, account.statementDay, account.paymentDueDay)
}

export function cardCycle(
  statementDay: number | null,
  paymentDueDay: number | null,
  today: IsoDate
): CardCycle {
  let lastStatement: IsoDate | null = null
  let nextStatement: IsoDate | null = null
  if (statementDay !== null) {
    const thisMonth = dayIn(today, 0, statementDay)
    lastStatement = thisMonth <= today ? thisMonth : dayIn(today, -1, statementDay)
    nextStatement = dayAfter(today, statementDay)
  }

  if (paymentDueDay === null) {
    return { lastStatement, nextStatement, dueDate: null, dueStatement: null }
  }
  if (lastStatement === null || nextStatement === null) {
    // No statement day: the next due day from today on.
    const thisMonth = dayIn(today, 0, paymentDueDay)
    const dueDate = thisMonth >= today ? thisMonth : dayIn(today, 1, paymentDueDay)
    return { lastStatement, nextStatement, dueDate, dueStatement: null }
  }
  // The payment for the last statement, unless its due date has passed: then the next one's.
  const lastDue = dayAfter(lastStatement, paymentDueDay)
  return lastDue >= today
    ? { lastStatement, nextStatement, dueDate: lastDue, dueStatement: lastStatement }
    : {
        lastStatement,
        nextStatement,
        dueDate: dayAfter(nextStatement, paymentDueDay),
        dueStatement: nextStatement
      }
}

/** A card bill due soon (or overdue) and not paid in full: Month offers to pay it. */
export interface CardBillDue {
  accountId: number
  name: string
  dueDate: IsoDate
  /** What's left to pay on the statement. */
  amount: Cents
  /** The account the bill is paid from. */
  payFromAccountId: number | null
}

/** How many days before its due date a card bill waits on Month. */
export const CARD_BILL_NOTICE_DAYS = 7

/** A credit card's usage and what to pay next (PLAN.md step 24). */
export interface CardStatus {
  accountId: number
  limit: Cents
  /** What you owe on the card today; 0 when it's paid off or in credit. */
  owed: Cents
  /** Limit minus what's owed and what's reserved for installments. */
  available: Cents
  /** Installments bought on the card and not charged yet: they hold part of the limit. */
  reserved: Cents
  /** owed / limit: 0.25 is 25%; above 1 when over the limit. */
  utilization: number
  cycle: CardCycle
  /** Owed when the statement `cycle.dueStatement` closed; null if it hasn't closed yet. */
  statementBalance: Cents | null
  /** Payments and refunds into the card since that statement closed. */
  paidSinceStatement: Cents | null
  /**
   * What to pay by `cycle.dueDate`: the statement balance less what's been paid since, or
   * without a statement day, everything owed. Null when there's no due date or the statement
   * hasn't closed yet.
   */
  leftToPay: Cents | null
}

/** Days before a card's payment is due that its reminder goes off. */
export const CARD_DUE_REMINDER_DAYS = 3

export const accountSeriesQuerySchema = z
  .object({
    accountId: z.number().int().positive(),
    from: z.string().refine(isIsoDate, 'Choose a date'),
    to: z.string().refine(isIsoDate, 'Choose a date')
  })
  .strict()
  .refine((q) => q.from <= q.to, { message: 'The range ends before it starts', path: ['to'] })
export type AccountSeriesQuery = z.input<typeof accountSeriesQuerySchema>

/** An account's balance at the end of a day. */
export interface BalancePoint {
  date: IsoDate
  balance: Cents
}
