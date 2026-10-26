import type Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import type { TransactionInput } from '@shared/transactions'
import { seedDemoData } from '../../dev/seed'
import { createTestDb } from '../testing'
import { createAccount, listAccounts, setAccountArchived } from './accounts'
import { listCategories, updateCategory } from './categories'
import { updateSettings } from './settings'
import { getCategoryTotals, getLargest, getSeries, getTotals } from './stats'
import { createTransaction } from './transactions'

let db: Database.Database
let debit: number
let card: number
let cash: number

const categoryId = (name: string): number => {
  const category = listCategories(db).find((c) => c.name === name)
  if (!category) throw new Error(`No category ${name}`)
  return category.id
}

const add = (
  type: 'income' | 'expense',
  amount: number,
  date: string,
  category: string,
  accountId = debit
): void => {
  createTransaction(db, {
    type,
    title: '',
    amount,
    date,
    accountId,
    categoryId: categoryId(category),
    note: null
  } as TransactionInput)
}

const transfer = (amount: number, date: string, from: number, to: number): void => {
  createTransaction(db, {
    type: 'transfer',
    title: '',
    amount,
    date,
    accountId: from,
    toAccountId: to,
    note: null
  })
}

/** Savings and loan movements have their own screens later; write them straight in. */
const movement = (
  type: 'savings_deposit' | 'savings_withdrawal' | 'loan_out' | 'loan_in',
  amount: number,
  date: string
): void => {
  const savings = type.startsWith('savings')
  db.prepare(
    `INSERT INTO transactions (date, title, amount, type, account_id, savings_goal_id, loan_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(date, type, amount, type, debit, savings ? goal : null, savings ? null : loan)
}

let goal: number
let loan: number

beforeEach(() => {
  db = createTestDb()
  debit = createAccount(db, {
    type: 'debit',
    name: 'Visa Debit',
    openingBalance: 100000,
    openingDate: '2026-09-01',
    color: 'blue'
  }).id
  card = createAccount(db, {
    type: 'credit',
    name: 'Mastercard',
    openingBalance: -20000,
    openingDate: '2026-09-01',
    creditLimit: 300000,
    statementDay: null,
    paymentDueDay: null,
    color: 'orange'
  }).id
  cash = createAccount(db, {
    type: 'cash',
    name: 'Wallet',
    openingBalance: 5000,
    openingDate: '2026-10-10',
    color: 'aqua'
  }).id
  goal = Number(
    db.prepare("INSERT INTO savings_goals (name, target_amount) VALUES ('Holiday', 100000)").run()
      .lastInsertRowid
  )
  loan = Number(
    db
      .prepare(
        `INSERT INTO loans (kind, title, counterparty, principal, start_date)
         VALUES ('lent', 'Loan to Ana', 'Ana', 30000, '2026-10-01')`
      )
      .run().lastInsertRowid
  )
})

describe('getTotals', () => {
  it('keeps income and expenses apart from savings, loans and transfers', () => {
    add('income', 245000, '2026-10-01', 'Salary')
    add('expense', 4250, '2026-10-03', 'Groceries')
    add('expense', 12000, '2026-10-05', 'Shopping', card)
    transfer(20000, '2026-10-06', debit, card)
    movement('savings_deposit', 10000, '2026-10-07')
    movement('savings_withdrawal', 2500, '2026-10-08')
    movement('loan_out', 30000, '2026-10-09')
    movement('loan_in', 5000, '2026-10-10')

    expect(getTotals(db, { from: '2026-10-01', to: '2026-10-31' })).toEqual({
      income: 245000,
      expenses: 16250,
      net: 228750,
      savingsDeposits: 10000,
      savingsWithdrawals: 2500,
      loansOut: 30000,
      loansIn: 5000,
      cashFlow: 245000 - 16250 - 10000 + 2500 - 30000 + 5000,
      count: 8
    })
  })

  it('includes both ends of the range and nothing outside it', () => {
    add('expense', 100, '2026-09-30', 'Groceries')
    add('expense', 200, '2026-10-01', 'Groceries')
    add('expense', 300, '2026-10-31', 'Groceries')
    add('expense', 400, '2026-11-01', 'Groceries')

    const totals = getTotals(db, { from: '2026-10-01', to: '2026-10-31' })
    expect(totals.expenses).toBe(500)
    expect(totals.count).toBe(2)
  })

  it('is all zeros for an empty range', () => {
    expect(getTotals(db, { from: '2026-10-01', to: '2026-10-01' })).toMatchObject({
      income: 0,
      expenses: 0,
      net: 0,
      cashFlow: 0,
      count: 0
    })
  })

  it('refuses a range that ends before it starts or is too long', () => {
    expect(() => getTotals(db, { from: '2026-10-02', to: '2026-10-01' })).toThrow(/ends before/)
    expect(() => getTotals(db, { from: '2016-01-01', to: '2026-12-31' })).toThrow(/ten years/)
    expect(() => getTotals(db, { from: '2026-02-30', to: '2026-03-01' })).toThrow(/date/)
  })
})

describe('getSeries', () => {
  it('has every day, empty ones included, with the balance at the end of each', () => {
    add('income', 10000, '2026-10-02', 'Salary')
    add('expense', 3000, '2026-10-02', 'Groceries', card)
    add('expense', 1000, '2026-10-04', 'Groceries')

    const series = getSeries(db, { from: '2026-10-01', to: '2026-10-04', by: 'day' })
    expect(series.map((p) => [p.start, p.end, p.income, p.expenses, p.balance])).toEqual([
      // Opening balances: 1,000.00 on the debit card, 200.00 owed on the credit card.
      ['2026-10-01', '2026-10-01', 0, 0, 80000],
      ['2026-10-02', '2026-10-02', 10000, 3000, 87000],
      ['2026-10-03', '2026-10-03', 0, 0, 87000],
      ['2026-10-04', '2026-10-04', 0, 1000, 86000]
    ])
  })

  it('carries the balance from before the range and counts accounts from their opening date', () => {
    add('expense', 2000, '2026-09-15', 'Groceries')
    // The wallet opens on 10 October with 50.00.
    const series = getSeries(db, { from: '2026-10-09', to: '2026-10-10', by: 'day' })
    expect(series.map((p) => p.balance)).toEqual([78000, 83000])
  })

  it('ignores transfers between accounts for the balance, but not money leaving them', () => {
    transfer(20000, '2026-10-06', debit, card)
    transfer(4000, '2026-10-12', debit, cash)
    movement('savings_deposit', 10000, '2026-10-12')

    const [day] = getSeries(db, { from: '2026-10-12', to: '2026-10-12', by: 'day' })
    expect(day.balance).toBe(80000 + 5000 - 10000)
    expect(day.cashFlow).toBe(-10000)
  })

  it('leaves archived accounts out of the balance, but not their transactions out of the totals', () => {
    add('expense', 1500, '2026-10-12', 'Eating out', cash)
    setAccountArchived(db, cash, true)

    const [day] = getSeries(db, { from: '2026-10-12', to: '2026-10-12', by: 'day' })
    expect(day.balance).toBe(80000)
    expect(day.expenses).toBe(1500)
  })

  it('ignores transactions dated before an account opened, like the account balance does', () => {
    // Allowed only by writing straight to the table: history the opening balance includes.
    db.prepare(
      `INSERT INTO transactions (date, title, amount, type, account_id, category_id)
       VALUES ('2026-10-05', 'Old', 999, 'expense', ?, ?)`
    ).run(cash, categoryId('Groceries'))

    const [day] = getSeries(db, { from: '2026-10-12', to: '2026-10-12', by: 'day' })
    expect(day.balance).toBe(85000)
  })

  it('cuts months to the range', () => {
    add('income', 245000, '2026-09-30', 'Salary')
    add('expense', 4000, '2026-10-01', 'Groceries')
    add('expense', 6000, '2026-11-20', 'Groceries')
    add('expense', 9000, '2026-11-26', 'Groceries')

    const series = getSeries(db, { from: '2026-09-15', to: '2026-11-25', by: 'month' })
    expect(series.map((p) => [p.start, p.end, p.income, p.expenses, p.balance])).toEqual([
      ['2026-09-15', '2026-09-30', 245000, 0, 325000],
      ['2026-10-01', '2026-10-31', 0, 4000, 326000],
      ['2026-11-01', '2026-11-25', 0, 6000, 320000]
    ])
  })

  it('starts weeks on the day set in Settings', () => {
    // Sunday 25 and Monday 26 October 2026.
    add('expense', 100, '2026-10-25', 'Groceries')
    add('expense', 200, '2026-10-26', 'Groceries')
    const weeks = (): [string, string, number][] =>
      getSeries(db, { from: '2026-10-19', to: '2026-11-01', by: 'week' }).map((p) => [
        p.start,
        p.end,
        p.expenses
      ])

    expect(weeks()).toEqual([
      ['2026-10-19', '2026-10-25', 100],
      ['2026-10-26', '2026-11-01', 200]
    ])

    updateSettings(db, { weekStart: 0 })
    expect(weeks()).toEqual([
      ['2026-10-19', '2026-10-24', 0],
      ['2026-10-25', '2026-10-31', 300],
      ['2026-11-01', '2026-11-01', 0]
    ])
  })
})

describe('with a year of demo data', () => {
  const TODAY = '2026-10-26'

  beforeEach(() => {
    db = createTestDb()
    seedDemoData(db, TODAY)
  })

  it('ends each period on the same total balance as the accounts', () => {
    const total = (asOf: string): number =>
      listAccounts(db, asOf)
        .filter((a) => !a.isArchived)
        .reduce((sum, a) => sum + a.balance, 0)
    const series = getSeries(db, { from: '2025-11-01', to: TODAY, by: 'month' })

    expect(series).toHaveLength(12)
    for (const period of series) expect(period.balance).toBe(total(period.end))
  })

  it('adds up to the same totals by day, week and month', () => {
    const range = { from: '2025-11-01', to: TODAY }
    const whole = getTotals(db, range)
    expect(whole.income).toBeGreaterThan(0)
    for (const by of ['day', 'week', 'month'] as const) {
      const series = getSeries(db, { ...range, by })
      const sum = (key: 'income' | 'expenses' | 'cashFlow' | 'count'): number =>
        series.reduce((total, p) => total + p[key], 0)
      expect([sum('income'), sum('expenses'), sum('cashFlow'), sum('count')]).toEqual([
        whole.income,
        whole.expenses,
        whole.cashFlow,
        whole.count
      ])
    }
  })

  it('splits expenses by category to the same total', () => {
    const range = { from: '2025-11-01', to: TODAY }
    const categories = getCategoryTotals(db, { ...range, type: 'expense' })
    expect(categories.reduce((sum, c) => sum + c.total, 0)).toBe(getTotals(db, range).expenses)
  })
})

describe('getCategoryTotals', () => {
  it('sums one type per category, largest first, archived categories included', () => {
    add('expense', 4000, '2026-10-01', 'Groceries')
    add('expense', 3000, '2026-10-02', 'Groceries')
    add('expense', 9000, '2026-10-03', 'Rent')
    add('expense', 2500, '2026-10-04', 'Eating out')
    add('expense', 8000, '2026-11-01', 'Eating out')
    add('income', 245000, '2026-10-01', 'Salary')
    updateCategory(db, categoryId('Eating out'), { isArchived: true })

    expect(
      getCategoryTotals(db, { from: '2026-10-01', to: '2026-10-31', type: 'expense' })
    ).toEqual([
      { categoryId: categoryId('Rent'), total: 9000, count: 1 },
      { categoryId: categoryId('Groceries'), total: 7000, count: 2 },
      { categoryId: categoryId('Eating out'), total: 2500, count: 1 }
    ])
    expect(getCategoryTotals(db, { from: '2026-10-01', to: '2026-10-31', type: 'income' })).toEqual(
      [{ categoryId: categoryId('Salary'), total: 245000, count: 1 }]
    )
  })
})

describe('getLargest', () => {
  it('lists the largest of one type in the range, earliest first on ties', () => {
    add('expense', 4000, '2026-10-03', 'Groceries')
    add('expense', 9000, '2026-10-04', 'Rent')
    add('expense', 4000, '2026-10-01', 'Eating out')
    add('expense', 1000, '2026-10-02', 'Groceries')
    add('expense', 50000, '2026-11-01', 'Shopping')
    add('income', 245000, '2026-10-01', 'Salary')

    const largest = getLargest(db, {
      from: '2026-10-01',
      to: '2026-10-31',
      type: 'expense',
      limit: 3
    })
    expect(largest.map((t) => [t.date, t.amount])).toEqual([
      ['2026-10-04', 9000],
      ['2026-10-01', 4000],
      ['2026-10-03', 4000]
    ])
  })
})
