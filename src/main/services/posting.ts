import type { Database } from 'better-sqlite3'
import { addDays, formatDate, type IsoDate } from '@shared/dates'
import { nextOccurrence, occurrences } from '@shared/recurrence'
import {
  hasEnded,
  postOccurrenceSchema,
  postedType,
  type DueOccurrence,
  type PostOccurrenceInput,
  type RecurringItem
} from '@shared/recurring'
import { installmentSchedule, installmentTitle } from '@shared/installments'
import type { Transaction, TransactionInput } from '@shared/transactions'
import { AppError } from '../errors'
import {
  getRecurringItem,
  listRecurringItems,
  setActive,
  setEndDate,
  setNextDueDate
} from '../db/repositories/recurring'
import { payInstallment } from '../db/repositories/bankLoans'
import { chargedDates, listInstallmentPlans } from '../db/repositories/installments'
import { getSettings } from '../db/repositories/settings'
import { checkTransaction, createPlannedTransaction } from '../db/repositories/transactions'

// Posting service (PLAN.md step 20). Turns recurring items into transactions when they fall
// due: automatically for items that post themselves, after confirmation ("Due now") for the
// rest. An occurrence is settled when a transaction links to the item with its planned date;
// `next_due_date` is the first occurrence that is neither settled nor skipped.

function isSettled(db: Database, itemId: number, plannedDate: IsoDate): boolean {
  return !!db
    .prepare('SELECT 1 FROM transactions WHERE recurring_item_id = ? AND planned_date = ?')
    .get(itemId, plannedDate)
}

/** The occurrence after `date`, ignoring the end date: past the end means the item has ended. */
const following = (item: RecurringItem, date: IsoDate): IsoDate =>
  nextOccurrence({ ...item, endDate: null }, date) as IsoDate

/** Moves `next_due_date` past occurrences that are already settled. */
function advance(db: Database, item: RecurringItem): void {
  let next = item.nextDueDate
  while (isSettled(db, item.id, next)) next = following(item, next)
  if (next !== item.nextDueDate) setNextDueDate(db, item.id, next)
}

/** The transaction an occurrence posts, before any changes made when confirming it. */
function plannedInput(item: RecurringItem, plannedDate: IsoDate): TransactionInput {
  return {
    type: postedType(item.kind),
    title: item.title,
    amount: item.amount,
    date: plannedDate,
    accountId: item.accountId,
    categoryId: item.categoryId,
    note: null
  }
}

/** Occurrences from the next due date to `today` that no transaction settles yet. */
function unsettled(db: Database, item: RecurringItem, today: IsoDate): IsoDate[] {
  return occurrences(item, item.nextDueDate, today).filter((d) => !isSettled(db, item.id, d))
}

/** Posts an item's due occurrences if it posts automatically, then moves its next due date on. */
function postItem(db: Database, item: RecurringItem, today: IsoDate): number {
  let posted = 0
  db.transaction(() => {
    if (item.isActive && item.autoPost) {
      for (const plannedDate of unsettled(db, item, today)) {
        try {
          createPlannedTransaction(db, plannedInput(item, plannedDate), {
            recurringItemId: item.id,
            plannedDate
          })
          posted++
        } catch (error) {
          if (!(error instanceof AppError)) throw error
        }
      }
    }
    advance(db, item)
  })()
  return posted
}

/**
 * Posts every occurrence that has fallen due by `today` for active items that post
 * automatically, then moves each item's next due date on. An occurrence that can't be posted
 * as it stands (its account is archived, say) stays due and waits in `dueOccurrences`.
 * Returns how many transactions were posted. Safe to run any number of times.
 */
export function postDueItems(db: Database, today: IsoDate): number {
  let posted = 0
  for (const item of listRecurringItems(db)) {
    if (item.isActive && item.nextDueDate <= today) posted += postItem(db, item, today)
  }
  return posted
}

/** Occurrences that have fallen due by `today` and wait to be confirmed or skipped, oldest first. */
export function dueOccurrences(db: Database, today: IsoDate): DueOccurrence[] {
  const due: DueOccurrence[] = []
  for (const item of listRecurringItems(db)) {
    if (!item.isActive || item.nextDueDate > today) continue
    for (const plannedDate of unsettled(db, item, today)) {
      let problem: string | null = null
      try {
        checkTransaction(db, plannedInput(item, plannedDate))
      } catch (error) {
        if (!(error instanceof AppError)) throw error
        problem = error.message
      }
      due.push({ item, plannedDate, problem })
    }
  }
  return due.sort((a, b) => a.plannedDate.localeCompare(b.plannedDate) || a.item.id - b.item.id)
}

/** Throws unless `plannedDate` is an occurrence of the item that can still be posted or skipped. */
function checkOpen(db: Database, item: RecurringItem, plannedDate: IsoDate): void {
  if (occurrences(item, plannedDate, plannedDate).length === 0) {
    const { locale } = getSettings(db)
    throw new AppError(
      'validation',
      `“${item.title}” isn’t due on ${formatDate(plannedDate, locale)}.`
    )
  }
  if (plannedDate < item.nextDueDate || isSettled(db, item.id, plannedDate)) {
    throw new AppError('conflict', `That “${item.title}” payment is already posted or skipped.`)
  }
}

/**
 * Posts one occurrence with the amount, account and date the user confirmed. Title and
 * category come from the item. Any occurrence from the next due date on can be posted,
 * including future ones paid early.
 */
export function postOccurrence(db: Database, input: PostOccurrenceInput): Transaction {
  const { itemId, plannedDate, date, amount, accountId } = postOccurrenceSchema.parse(input)
  const item = getRecurringItem(db, itemId)
  return db.transaction(() => {
    checkOpen(db, item, plannedDate)
    const tx = createPlannedTransaction(
      db,
      { ...plannedInput(item, plannedDate), date, amount, accountId },
      { recurringItemId: item.id, plannedDate }
    )
    advance(db, item)
    return tx
  })()
}

/**
 * Skips the next due occurrence without posting anything, e.g. a month the bill wasn't
 * charged. Only the earliest open occurrence can be skipped, since `next_due_date` is all
 * that records a skip.
 */
export function skipOccurrence(db: Database, itemId: number, plannedDate: IsoDate): RecurringItem {
  const item = getRecurringItem(db, itemId)
  db.transaction(() => {
    checkOpen(db, item, plannedDate)
    if (plannedDate !== item.nextDueDate) {
      throw new AppError('validation', `Skip the earlier “${item.title}” payments first.`)
    }
    setNextDueDate(db, item.id, following(item, plannedDate))
    advance(db, getRecurringItem(db, itemId))
  })()
  return getRecurringItem(db, itemId)
}

/** Brings one item up to date after it was created or edited: posts what is due, if it may. */
export function syncItem(db: Database, itemId: number, today: IsoDate): RecurringItem {
  postItem(db, getRecurringItem(db, itemId), today)
  return getRecurringItem(db, itemId)
}

/**
 * Pauses an item: nothing is posted or asked for while it is paused. On resuming, payments
 * that fell due during the pause are left out and it continues from the first one on or
 * after `today`.
 */
export function setItemActive(
  db: Database,
  itemId: number,
  active: boolean,
  today: IsoDate
): RecurringItem {
  const item = getRecurringItem(db, itemId)
  if (item.isActive === active) return item
  db.transaction(() => {
    setActive(db, item.id, active)
    if (active && item.nextDueDate < today) {
      setNextDueDate(db, item.id, following(item, addDays(today, -1)))
    }
    advance(db, getRecurringItem(db, itemId))
  })()
  return syncItem(db, itemId, today)
}

/**
 * Cancels an item from tomorrow on: it ends today, so payments up to today still count
 * (and wait in Due now if they ask first) and nothing after is posted. One that hasn't
 * started yet ends before its first payment.
 */
export function cancelItem(db: Database, itemId: number, today: IsoDate): RecurringItem {
  const item = getRecurringItem(db, itemId)
  if (hasEnded(item)) return item
  db.transaction(() => {
    if (item.anchorDate > today) {
      // The schema keeps the end on or after the anchor: end on it, past every occurrence.
      setEndDate(db, item.id, item.anchorDate)
      setNextDueDate(db, item.id, following(item, item.anchorDate))
    } else if (item.endDate === null || item.endDate > today) {
      setEndDate(db, item.id, today)
    }
  })()
  return getRecurringItem(db, itemId)
}

/**
 * Charges every installment whose date has come: an expense on the card, titled
 * "Laptop (2/5)" and linked to its plan and date. Runs with the recurring items on launch and
 * every hour. Installments always post, even to an archived card or category: the purchase
 * was made. Returns how many were charged.
 */
export function postDueInstallments(db: Database, today: IsoDate): number {
  const insert = db.prepare(
    `INSERT INTO transactions (date, title, amount, type, account_id, category_id,
       installment_plan_id, planned_date)
     VALUES (@date, @title, @amount, 'expense', @accountId, @categoryId, @planId, @date)`
  )
  let posted = 0
  for (const plan of listInstallmentPlans(db)) {
    if (plan.nextDate === null || plan.nextDate > today) continue
    const charged = chargedDates(db, plan.id)
    db.transaction(() => {
      for (const { seq, date, amount } of installmentSchedule(
        plan.totalAmount,
        plan.count,
        plan.firstDate
      )) {
        if (date > today || charged.has(date)) continue
        insert.run({
          date,
          title: installmentTitle(plan.title, seq, plan.count),
          amount,
          accountId: plan.accountId,
          categoryId: plan.categoryId,
          planId: plan.id
        })
        posted++
      }
    })()
  }
  return posted
}

/**
 * Marks paid every installment that has fallen due on bank loans paying automatically: from
 * the loan's account, on its due date, linked to the installment like a manual payment. The
 * loan's account pays even once archived, like card installments; one that can't be paid
 * (due before the account opened) stays due, as on manual loans.
 * Returns how many were paid.
 */
export function postDueLoanInstallments(db: Database, today: IsoDate): number {
  const due = db
    .prepare(
      `SELECT li.id, li.due_date, l.account_id FROM loan_installments li
       JOIN loans l ON l.id = li.loan_id
       WHERE l.kind = 'bank_loan' AND l.status = 'active' AND l.auto_pay = 1
         AND l.account_id IS NOT NULL AND li.due_date <= ?
         AND NOT EXISTS (SELECT 1 FROM transactions t WHERE t.loan_installment_id = li.id)
       ORDER BY li.due_date, li.seq`
    )
    .all(today) as { id: number; due_date: IsoDate; account_id: number }[]
  let paid = 0
  for (const row of due) {
    try {
      payInstallment(db, row.id, { accountId: row.account_id, date: row.due_date })
      paid++
    } catch (error) {
      if (!(error instanceof AppError)) throw error
    }
  }
  return paid
}
