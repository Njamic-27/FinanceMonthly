import { app } from 'electron'
import { join } from 'path'
import type { Database } from 'better-sqlite3'
import { is } from '@electron-toolkit/utils'
import { openDatabase } from './connection'
import { migrate } from './migrate'
import { migrations } from './migrations'

let db: Database | null = null

/** Development uses its own file so trying things out never touches real data. */
export function databasePath(): string {
  return join(app.getPath('userData'), is.dev ? 'finance-dev.db' : 'finance.db')
}

export function initDatabase(): Database {
  if (db) return db
  const file = databasePath()
  const opened = openDatabase(file)
  try {
    const { from, to } = migrate(opened, migrations)
    console.log(
      from === to ? `Database ready (schema v${to})` : `Database migrated v${from} → v${to}`,
      file
    )
  } catch (error) {
    opened.close()
    throw error
  }
  db = opened
  return db
}

export function getDb(): Database {
  if (!db) throw new Error('Database is not initialised — call initDatabase() first')
  return db
}

export function closeDatabase(): void {
  db?.close()
  db = null
}
