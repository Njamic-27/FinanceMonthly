import type Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { createTestDb } from './testing'

// Rules from PLAN.md §2 that the database itself must enforce.

let db: Database.Database
const run = (sql: string, ...params: unknown[]): Database.RunResult =>
  db.prepare(sql).run(...params)

const insertTx = (tx: {
  date?: string
  amount?: unknown
  type: string
  account_id?: number
  to_account_id?: number | null
  category_id?: number | null
  recurring_item_id?: number | null
  savings_goal_id?: number | null
  loan_id?: number | null
  planned_date?: string | null
}): Database.RunResult =>
  run(
    `INSERT INTO transactions (date, title, amount, type, account_id, to_account_id, category_id,
       recurring_item_id, savings_goal_id, loan_id, planned_date)
     VALUES (?, 'Test', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    tx.date ?? '2026-10-20',
    tx.amount ?? 1000,
    tx.type,
    tx.account_id ?? DEBIT,
    tx.to_account_id ?? null,
    tx.category_id ?? null,
    tx.recurring_item_id ?? null,
    tx.savings_goal_id ?? null,
    tx.loan_id ?? null,
    tx.planned_date ?? null
  )

const DEBIT = 1
const CASH = 2
const CARD = 3
const GROCERIES = 1
const SUBSCRIPTIONS = 3

beforeEach(() => {
  db = createTestDb()
  run(`INSERT INTO accounts (id, name, type, opening_balance, opening_date) VALUES
         (1, 'Visa Debit', 'debit', 150000, '2026-10-01'),
         (2, 'Wallet', 'cash', 0, '2026-10-01')`)
  run(`INSERT INTO accounts (id, name, type, opening_balance, opening_date, credit_limit, statement_day, payment_due_day)
       VALUES (3, 'Mastercard', 'credit', -20000, '2026-10-01', 300000, 25, 15)`)
  run('DELETE FROM categories') // fixed ids below instead of the seeded defaults
  run(`INSERT INTO categories (id, name, type) VALUES
         (1, 'Groceries', 'expense'), (2, 'Salary', 'income'), (3, 'Subscriptions', 'expense')`)
})

describe('accounts', () => {
  it('allows credit-card fields only on credit cards', () => {
    expect(() =>
      run(
        "INSERT INTO accounts (name, type, opening_date, credit_limit) VALUES ('X', 'debit', '2026-10-01', 1000)"
      )
    ).toThrow(/CHECK/)
  })

  it('rejects unknown account types', () => {
    expect(() =>
      run("INSERT INTO accounts (name, type, opening_date) VALUES ('X', 'savings', '2026-10-01')")
    ).toThrow(/CHECK/)
  })
})

describe('categories', () => {
  it('are unique per type, ignoring case', () => {
    expect(() =>
      run("INSERT INTO categories (name, type) VALUES ('groceries', 'expense')")
    ).toThrow(/UNIQUE/)
    expect(() =>
      run("INSERT INTO categories (name, type) VALUES ('Groceries', 'income')")
    ).not.toThrow()
  })
})

describe('transactions', () => {
  it('accepts a normal expense', () => {
    expect(() => insertTx({ type: 'expense', category_id: GROCERIES })).not.toThrow()
  })

  it('requires a positive whole number of cents', () => {
    expect(() => insertTx({ type: 'expense', category_id: GROCERIES, amount: 45.99 })).toThrow()
    expect(() => insertTx({ type: 'expense', category_id: GROCERIES, amount: 0 })).toThrow(/CHECK/)
    expect(() => insertTx({ type: 'expense', category_id: GROCERIES, amount: -5 })).toThrow(/CHECK/)
  })

  it('requires YYYY-MM-DD dates', () => {
    expect(() => insertTx({ type: 'expense', category_id: GROCERIES, date: '2026-10-5' })).toThrow(
      /CHECK/
    )
  })

  it('requires an existing account', () => {
    expect(() => insertTx({ type: 'expense', category_id: GROCERIES, account_id: 99 })).toThrow(
      /FOREIGN KEY/
    )
  })

  it('requires a category on income and expenses, and only there', () => {
    expect(() => insertTx({ type: 'expense' })).toThrow(/CHECK/)
    expect(() =>
      insertTx({ type: 'transfer', to_account_id: CASH, category_id: GROCERIES })
    ).toThrow(/CHECK/)
  })

  it('requires transfers to go to a different account', () => {
    expect(() => insertTx({ type: 'transfer', to_account_id: CASH })).not.toThrow()
    expect(() => insertTx({ type: 'transfer' })).toThrow(/CHECK/)
    expect(() => insertTx({ type: 'transfer', to_account_id: DEBIT })).toThrow(/CHECK/)
    expect(() =>
      insertTx({ type: 'expense', category_id: GROCERIES, to_account_id: CASH })
    ).toThrow(/CHECK/)
  })

  it('links savings movements to a goal', () => {
    expect(() => insertTx({ type: 'savings_deposit' })).toThrow(/CHECK/)
    run("INSERT INTO savings_goals (id, name, target_amount) VALUES (1, 'Holiday', 200000)")
    expect(() => insertTx({ type: 'savings_deposit', savings_goal_id: 1 })).not.toThrow()
    expect(() => insertTx({ type: 'expense', category_id: GROCERIES, savings_goal_id: 1 })).toThrow(
      /CHECK/
    )
  })

  it('links loan movements to a loan', () => {
    expect(() => insertTx({ type: 'loan_out' })).toThrow(/CHECK/)
  })

  it('updates updated_at on change', async () => {
    const { lastInsertRowid } = insertTx({ type: 'expense', category_id: GROCERIES })
    const read = (): string =>
      (
        db.prepare('SELECT updated_at FROM transactions WHERE id = ?').get(lastInsertRowid) as {
          updated_at: string
        }
      ).updated_at
    const before = read()
    await new Promise((r) => setTimeout(r, 5))
    run('UPDATE transactions SET title = ? WHERE id = ?', 'Lidl weekly shop', lastInsertRowid)
    expect(read()).not.toBe(before)
  })
})

describe('planned items', () => {
  beforeEach(() => {
    run(`INSERT INTO recurring_items (id, kind, title, amount, account_id, category_id, frequency, anchor_date, next_due_date)
         VALUES (1, 'subscription', 'Netflix', 1399, ${CARD}, ${SUBSCRIPTIONS}, 'monthly', '2026-10-05', '2026-11-05')`)
  })

  it('can be settled once per occurrence', () => {
    const settle = (date: string): Database.RunResult =>
      insertTx({
        type: 'expense',
        account_id: CARD,
        category_id: SUBSCRIPTIONS,
        recurring_item_id: 1,
        planned_date: '2026-10-05',
        date
      })
    expect(() => settle('2026-10-06')).not.toThrow()
    expect(() => settle('2026-10-07')).toThrow(/UNIQUE/)
  })

  it('need a source when planned_date is set', () => {
    expect(() =>
      insertTx({ type: 'expense', category_id: GROCERIES, planned_date: '2026-10-05' })
    ).toThrow(/CHECK/)
  })

  it('reject an end date before the start', () => {
    expect(() =>
      run(`INSERT INTO recurring_items (kind, title, amount, account_id, category_id, frequency, anchor_date, end_date, next_due_date)
           VALUES ('expense', 'Rent', 50000, ${DEBIT}, ${GROCERIES}, 'monthly', '2026-10-05', '2026-09-01', '2026-11-05')`)
    ).toThrow(/CHECK/)
  })
})

describe('installment plans and loans', () => {
  it('need at least 2 installments', () => {
    const plan = (n: number): Database.RunResult =>
      run(
        `INSERT INTO installment_plans (account_id, title, category_id, total_amount, installments_count, first_date)
         VALUES (?, 'Laptop', ?, 200000, ?, '2026-10-20')`,
        CARD,
        GROCERIES,
        n
      )
    expect(() => plan(1)).toThrow(/CHECK/)
    expect(() => plan(5)).not.toThrow()
  })

  it('delete a loan’s schedule with the loan', () => {
    run(`INSERT INTO loans (id, kind, title, counterparty, principal, interest_rate, start_date, installments_count)
         VALUES (1, 'bank_loan', 'Car', 'Bank', 1000000, 5.5, '2026-01-01', 2)`)
    run(`INSERT INTO loan_installments (loan_id, seq, due_date, amount, principal_part, interest_part)
         VALUES (1, 1, '2026-02-01', 510000, 500000, 10000), (1, 2, '2026-03-01', 505000, 500000, 5000)`)
    run('DELETE FROM loans WHERE id = 1')
    expect(db.prepare('SELECT count(*) AS n FROM loan_installments').get()).toEqual({ n: 0 })
  })
})

describe('month sheet', () => {
  const summary = (date: string, categoryId = GROCERIES): Database.RunResult =>
    run(
      `INSERT INTO transactions (date, title, amount, type, account_id, category_id, is_month_total)
       VALUES (?, 'Groceries', 1000, 'expense', ?, ?, 1)`,
      date,
      DEBIT,
      categoryId
    )

  it('keeps one monthly summary per category and month', () => {
    expect(() => summary('2026-10-20')).not.toThrow()
    expect(() => summary('2026-10-31')).toThrow(/UNIQUE/)
    expect(() => summary('2026-11-30')).not.toThrow()
    expect(() => summary('2026-10-31', SUBSCRIPTIONS)).not.toThrow()
    // Ordinary transactions are as many as you like.
    expect(() => insertTx({ type: 'expense', category_id: GROCERIES })).not.toThrow()
  })

  it('keeps one card payment summary per card and month', () => {
    const payment = (): Database.RunResult =>
      run(
        `INSERT INTO transactions (date, title, amount, type, account_id, to_account_id, is_month_total)
         VALUES ('2026-10-20', 'Mastercard payment', 1000, 'transfer', ?, ?, 1)`,
        DEBIT,
        CARD
      )
    expect(() => payment()).not.toThrow()
    expect(() => payment()).toThrow(/UNIQUE/)
  })

  it('has one row per category, removed with the category', () => {
    const row = (): Database.RunResult =>
      run(
        `INSERT INTO month_rows (section, category_id, default_account_id) VALUES ('expense', ?, ?)`,
        GROCERIES,
        DEBIT
      )
    expect(() => row()).not.toThrow()
    expect(() => row()).toThrow(/UNIQUE/)
    run('DELETE FROM categories WHERE id = ?', GROCERIES)
    expect(db.prepare('SELECT count(*) AS n FROM month_rows').get()).toEqual({ n: 0 })
  })
})

describe('integrity', () => {
  it('has no foreign-key or integrity problems', () => {
    expect(db.pragma('foreign_key_check')).toEqual([])
    expect(db.pragma('integrity_check', { simple: true })).toBe('ok')
  })
})
