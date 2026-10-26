import Database from 'better-sqlite3'
import { migrate } from './migrate'
import { migrations } from './migrations'

/** A fresh in-memory database with the full schema, for tests. */
export function createTestDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  migrate(db, migrations)
  return db
}
