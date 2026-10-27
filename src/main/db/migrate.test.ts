import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { migrate, schemaVersion, type Migration } from './migrate'
import { migrations } from './migrations'

const tables = (db: Database.Database): string[] =>
  (
    db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .all() as { name: string }[]
  )
    .map((r) => r.name)
    .sort()

describe('migrate', () => {
  it('brings a new database to the latest version', () => {
    const db = new Database(':memory:')
    expect(migrate(db, migrations)).toEqual({ from: 0, to: migrations.length })
    expect(tables(db)).toEqual([
      'accounts',
      'categories',
      'installment_plans',
      'loan_installments',
      'loans',
      'month_rows',
      'notification_log',
      'recurring_items',
      'savings_goals',
      'settings',
      'transactions'
    ])
  })

  it('does nothing when already up to date', () => {
    const db = new Database(':memory:')
    migrate(db, migrations)
    expect(migrate(db, migrations)).toEqual({ from: migrations.length, to: migrations.length })
  })

  it('applies only the pending migrations', () => {
    const db = new Database(':memory:')
    const extra: Migration = {
      version: 2,
      name: 'add notes',
      sql: 'CREATE TABLE notes (id INTEGER PRIMARY KEY);'
    }
    migrate(db, [migrations[0]])
    expect(migrate(db, [migrations[0], extra])).toEqual({ from: 1, to: 2 })
    expect(tables(db)).toContain('notes')
  })

  it('rolls back a failing migration completely', () => {
    const db = new Database(':memory:')
    migrate(db, [migrations[0]])
    const broken: Migration = {
      version: 2,
      name: 'broken',
      sql: 'CREATE TABLE half_done (id INTEGER); SELECT * FROM does_not_exist;'
    }
    expect(() => migrate(db, [migrations[0], broken])).toThrow(/does_not_exist/)
    expect(schemaVersion(db)).toBe(1)
    expect(tables(db)).not.toContain('half_done')
  })

  it('refuses a database from a newer version of the app', () => {
    const db = new Database(':memory:')
    db.pragma('user_version = 99')
    expect(() => migrate(db, migrations)).toThrow(/Update the app/)
  })

  it('rejects gaps or duplicates in migration versions', () => {
    const db = new Database(':memory:')
    expect(() => migrate(db, [{ ...migrations[0], version: 2 }])).toThrow(/expected 1/)
  })
})
