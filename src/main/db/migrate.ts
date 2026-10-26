import type { Database } from 'better-sqlite3'

export interface Migration {
  /** Schema version after this migration runs; versions start at 1 and have no gaps. */
  version: number
  name: string
  sql: string
}

export interface MigrationResult {
  from: number
  to: number
}

export function schemaVersion(db: Database): number {
  return db.pragma('user_version', { simple: true }) as number
}

/**
 * Brings the database up to the latest schema. Each migration runs in its own transaction
 * together with the `user_version` bump, so a failure leaves the previous version intact.
 */
export function migrate(db: Database, migrations: Migration[]): MigrationResult {
  migrations.forEach((m, i) => {
    if (m.version !== i + 1) {
      throw new Error(`Migration "${m.name}" has version ${m.version}, expected ${i + 1}`)
    }
  })

  const from = schemaVersion(db)
  const latest = migrations.length
  if (from > latest) {
    throw new Error(
      `The database uses schema version ${from}, but this version of the app only knows ${latest}. Update the app to open it.`
    )
  }

  for (const m of migrations.slice(from)) {
    db.transaction(() => {
      db.exec(m.sql)
      db.pragma(`user_version = ${m.version}`)
    })()
  }

  return { from, to: schemaVersion(db) }
}
