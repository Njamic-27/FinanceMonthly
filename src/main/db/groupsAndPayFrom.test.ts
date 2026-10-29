import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { registerFunctions } from './functions'
import { migrate } from './migrate'
import { migrations } from './migrations'
import { createAccount, getAccount } from './repositories/accounts'
import { createCategory, listCategories, updateCategory } from './repositories/categories'
import { getSettings } from './repositories/settings'
import { createTestDb } from './testing'

// Migration 007 and what it adds (PLAN.md §2, step 48).

const debitInput = (name: string): Parameters<typeof createAccount>[1] => ({
  type: 'debit',
  name,
  openingBalance: 0,
  openingDate: '2026-01-01',
  color: 'blue'
})

const cardInput = (payFromAccountId?: number | null): Parameters<typeof createAccount>[1] => ({
  type: 'credit',
  name: 'Mastercard',
  openingBalance: 0,
  openingDate: '2026-01-01',
  color: 'orange',
  creditLimit: 300000,
  statementDay: 25,
  paymentDueDay: 15,
  payFromAccountId
})

describe('category groups', () => {
  it('puts the built-in expense categories in their groups and marks them built in', () => {
    const db = createTestDb()
    const byName = new Map(listCategories(db).map((c) => [c.name, c]))
    expect(byName.get('Rent')).toMatchObject({ group: 'bills', builtinKey: 'rent' })
    expect(byName.get('Utilities')?.group).toBe('bills')
    expect(byName.get('Subscriptions')?.group).toBe('subscriptions')
    expect(byName.get('Groceries')?.group).toBe('everyday')
    expect(byName.get('Salary')).toMatchObject({ group: null, builtinKey: 'salary' })
  })

  it('gives new expense categories a group, Everyday unless chosen, and none to income', () => {
    const db = createTestDb()
    const fuel = createCategory(db, { name: 'Fuel', type: 'expense', color: 'blue', icon: 'fuel' })
    expect(fuel).toMatchObject({ group: 'everyday', builtinKey: null })
    const water = createCategory(db, {
      name: 'Water',
      type: 'expense',
      color: 'aqua',
      icon: 'zap',
      group: 'bills'
    })
    expect(water.group).toBe('bills')
    expect(updateCategory(db, fuel.id, { group: 'bills' }).group).toBe('bills')
    const tips = createCategory(db, {
      name: 'Tips',
      type: 'income',
      color: 'olive',
      icon: 'coins',
      group: 'bills'
    })
    expect(tips.group).toBeNull()
  })
})

describe('a card’s Paid from account', () => {
  it('is the first debit account unless chosen, and never a card', () => {
    const db = createTestDb()
    const first = createAccount(db, debitInput('Visa Debit')).id
    const second = createAccount(db, debitInput('Maestro')).id
    expect(createAccount(db, cardInput()).payFromAccountId).toBe(first)
    const chosen = createAccount(db, { ...cardInput(second), name: 'Visa Credit' })
    expect(chosen.payFromAccountId).toBe(second)
    expect(() => createAccount(db, { ...cardInput(chosen.id), name: 'Amex' })).toThrow(
      /not another card/
    )
    expect(getAccount(db, first).payFromAccountId).toBeNull()
  })
})

describe('migration 007', () => {
  it('drops the month-of-purchase setting and counts card spending on its bill', () => {
    const db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    registerFunctions(db)
    migrate(db, migrations.slice(0, 6))
    const debit = db
      .prepare(
        `INSERT INTO accounts (name, type, opening_balance, opening_date, color)
         VALUES ('Visa Debit', 'debit', 0, '2026-01-01', 'blue')`
      )
      .run().lastInsertRowid
    const card = db
      .prepare(
        `INSERT INTO accounts (name, type, opening_balance, opening_date, credit_limit,
           statement_day, payment_due_day, color)
         VALUES ('Mastercard', 'credit', 0, '2026-01-01', 300000, 25, 15, 'orange')`
      )
      .run().lastInsertRowid
    db.prepare(
      `INSERT INTO settings (key, value) VALUES ('card_spending_month', '"purchase"')`
    ).run()
    const groceries = (
      db.prepare("SELECT id FROM categories WHERE name = 'Groceries'").get() as { id: number }
    ).id
    db.prepare(
      `INSERT INTO transactions (date, title, amount, type, account_id, category_id)
       VALUES ('2026-10-20', 'Lidl', 4000, 'expense', ?, ?)`
    ).run(card, groceries)
    const countsOn = (): string =>
      (db.prepare('SELECT counts_on FROM transactions').get() as { counts_on: string }).counts_on
    expect(countsOn()).toBe('2026-10-20')

    migrate(db, migrations)
    expect(countsOn()).toBe('2026-11-15')
    expect(db.prepare("SELECT 1 FROM settings WHERE key = 'card_spending_month'").get()).toBe(
      undefined
    )
    expect(getSettings(db)).not.toHaveProperty('cardSpendingMonth')
    expect(getAccount(db, Number(card)).payFromAccountId).toBe(Number(debit))
  })
})
