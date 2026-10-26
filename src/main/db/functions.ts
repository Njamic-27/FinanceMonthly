import type { Database } from 'better-sqlite3'
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
}
