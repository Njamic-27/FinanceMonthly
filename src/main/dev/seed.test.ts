import type Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { createTestDb } from '../db/testing'
import { listAccounts } from '../db/repositories/accounts'
import { getSettings } from '../db/repositories/settings'
import { listTransactions } from '../db/repositories/transactions'
import { seedDemoData } from './seed'

const TODAY = '2026-10-26'
let db: Database.Database

beforeEach(() => {
  db = createTestDb()
})

interface Row {
  date: string
  title: string
  amount: number
  type: string
  account_id: number
  to_account_id: number | null
}

const rows = (sql = 'SELECT * FROM transactions ORDER BY id'): Row[] =>
  db.prepare(sql).all() as Row[]

/** Balance of an account at the end of every day that has a transaction. */
function dailyBalances(accountId: number): number[] {
  const opening = (
    db.prepare('SELECT opening_balance FROM accounts WHERE id = ?').get(accountId) as {
      opening_balance: number
    }
  ).opening_balance
  const incoming = ['income', 'savings_withdrawal', 'loan_in']
  const byDay = new Map<string, number>()
  for (const t of rows('SELECT * FROM transactions ORDER BY date, id')) {
    let change = 0
    if (t.account_id === accountId) change -= incoming.includes(t.type) ? -t.amount : t.amount
    if (t.to_account_id === accountId) change += t.amount
    if (change) byDay.set(t.date, (byDay.get(t.date) ?? 0) + change)
  }
  let balance = opening
  return [...byDay.keys()].sort().map((day) => (balance += byDay.get(day) ?? 0))
}

describe('seedDemoData', () => {
  it('covers the 12 months before today and this month so far', () => {
    const summary = seedDemoData(db, TODAY)
    expect(summary).toMatchObject({
      from: '2025-10-01',
      to: TODAY,
      accounts: 3,
      recurringItems: 5,
      installmentPlans: 1,
      savingsGoals: 1,
      loans: 2
    })
    const dates = rows().map((t) => t.date)
    expect(dates.every((d) => d >= '2025-10-01' && d <= TODAY)).toBe(true)
    expect(summary.transactions).toBe(dates.length)
    expect(dates.length).toBeGreaterThan(300)
  })

  it('is the same every time', () => {
    // Everything but the creation timestamps.
    const data = (): Row[] =>
      rows(
        `SELECT date, title, amount, type, account_id, to_account_id, category_id, recurring_item_id,
                savings_goal_id, loan_id, installment_plan_id, planned_date, note
         FROM transactions ORDER BY id`
      )
    seedDemoData(db, TODAY)
    const first = data()
    db = createTestDb()
    seedDemoData(db, TODAY)
    expect(data()).toEqual(first)
  })

  it('stores rows in date order', () => {
    seedDemoData(db, TODAY)
    const dates = rows().map((t) => t.date)
    expect(dates).toEqual([...dates].sort())
  })

  it('keeps debit and cash above zero and the card under its limit, every day', () => {
    seedDemoData(db, TODAY)
    const [debit, cash, card] = listAccounts(db, TODAY)
    expect(Math.min(...dailyBalances(debit.id))).toBeGreaterThanOrEqual(0)
    expect(Math.min(...dailyBalances(cash.id))).toBeGreaterThanOrEqual(0)
    expect(Math.min(...dailyBalances(card.id))).toBeGreaterThanOrEqual(-300000)
    expect(card.balance).toBeLessThanOrEqual(0)
  })

  it('posts every past charge of each recurring item and points to the next one', () => {
    seedDemoData(db, TODAY)
    const items = db
      .prepare(
        `SELECT r.title, r.next_due_date AS next, count(t.id) AS posted,
                sum(t.planned_date = t.date) AS onTime
         FROM recurring_items r LEFT JOIN transactions t ON t.recurring_item_id = r.id
         GROUP BY r.id ORDER BY r.id`
      )
      .all()
    expect(items).toEqual([
      { title: 'Salary', next: '2026-11-10', posted: 13, onTime: 13 },
      { title: 'Rent', next: '2026-11-01', posted: 13, onTime: 13 },
      { title: 'Netflix', next: '2026-11-05', posted: 13, onTime: 13 },
      { title: 'Spotify', next: '2026-11-12', posted: 13, onTime: 13 },
      { title: 'Claude', next: '2026-11-18', posted: 5, onTime: 5 }
    ])
  })

  it('posts the laptop installments due so far, leaving the last one to come', () => {
    seedDemoData(db, TODAY)
    const rates = rows(
      'SELECT * FROM transactions WHERE installment_plan_id IS NOT NULL ORDER BY date'
    )
    expect(rates.map((r) => [r.date, r.title, r.amount])).toEqual([
      ['2026-07-08', 'Laptop 1/5', 20999],
      ['2026-08-08', 'Laptop 2/5', 20999],
      ['2026-09-08', 'Laptop 3/5', 20999],
      ['2026-10-08', 'Laptop 4/5', 20999]
    ])
    expect(
      db.prepare('SELECT total_amount, installments_count FROM installment_plans').get()
    ).toEqual({ total_amount: 104999, installments_count: 5 })
  })

  it('saves monthly towards the goal and records the loan and its repayment', () => {
    seedDemoData(db, TODAY)
    const savings = rows("SELECT * FROM transactions WHERE type = 'savings_deposit'")
    expect(savings).toHaveLength(8) // 11 March to 11 October
    expect(savings.every((s) => s.amount === 15000)).toBe(true)
    expect(
      rows(
        "SELECT * FROM transactions WHERE type LIKE 'loan_%' AND loan_installment_id IS NULL ORDER BY date"
      ).map((r) => [r.type, r.amount])
    ).toEqual([
      ['loan_out', 30000],
      ['loan_in', 10000]
    ])
  })

  it('pays the card on the 15th for what was billed by the last statement', () => {
    seedDemoData(db, TODAY)
    const payments = rows("SELECT * FROM transactions WHERE title = 'Mastercard payment'")
    expect(payments.length).toBeGreaterThanOrEqual(11)
    expect(payments.every((p) => p.date.endsWith('-15'))).toBe(true)
  })

  it('works with the rest of the app: lists, totals and onboarding', () => {
    seedDemoData(db, TODAY)
    expect(getSettings(db).onboardingDone).toBe(true)
    const page = listTransactions(db, { from: '2026-09-01', to: '2026-09-30' })
    expect(page.summary?.income).toBe(245000)
    expect(page.summary?.expenses).toBeGreaterThan(100000)
  })

  it('only fills an empty database', () => {
    seedDemoData(db, TODAY)
    expect(() => seedDemoData(db, TODAY)).toThrow(/empty database/)
  })

  it('pays the car loan’s installments due so far, from the schedule', () => {
    seedDemoData(db, TODAY)
    const paid = rows(
      'SELECT t.* FROM transactions t JOIN loan_installments li ON li.id = t.loan_installment_id ORDER BY t.date'
    )
    // 20 March to 20 October
    expect(paid.map((t) => t.date)).toEqual([
      '2026-03-20',
      '2026-04-20',
      '2026-05-20',
      '2026-06-20',
      '2026-07-20',
      '2026-08-20',
      '2026-09-20',
      '2026-10-20'
    ])
    expect(paid[0]).toMatchObject({ title: 'Car loan 1/48', type: 'loan_out' })
    expect(db.prepare('SELECT count(*) AS n FROM loan_installments').get()).toEqual({ n: 48 })
  })
})
