import type { Database } from 'better-sqlite3'
import { formatDate, type IsoDate } from '@shared/dates'
import { nextOccurrence, occurrences } from '@shared/recurrence'
import {
  postOccurrenceSchema,
  postedType,
  type DueOccurrence,
  type PostOccurrenceInput,
  type RecurringItem
} from '@shared/recurring'
import type { Transaction, TransactionInput } from '@shared/transactions'
import { AppError } from '../errors'
import { getRecurringItem, listRecurringItems, setNextDueDate } from '../db/repositories/recurring'
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
