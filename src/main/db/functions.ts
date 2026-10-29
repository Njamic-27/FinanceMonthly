import type { Database } from 'better-sqlite3'
import { billDueDate } from '@shared/cards'
import { foldText } from '@shared/text'

/**
 * SQL functions the app's queries rely on. Registered on every connection, since SQLite
 * keeps them per connection.
 */
export function registerFunctions(db: Database): void {
  // fold(text): lower case without diacritics, for case- and accent-insensitive search.
  db.function('fold', { deterministic: true }, (text: unknown) =>
    typeof text === 'string' ? foldText(text) : null
  )
  // bill_due_date(date, statement_day, payment_due_day): the due date of the card bill a
  // purchase on `date` goes on. Keeps transactions.counts_on (migration 006).
  db.function(
    'bill_due_date',
    { deterministic: true },
    (date: unknown, statementDay: unknown, dueDay: unknown) =>
      typeof date === 'string' && typeof statementDay === 'number' && typeof dueDay === 'number'
        ? billDueDate(date, statementDay, dueDay)
        : null
  )
}
