import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { adjustmentAmount } from '@shared/adjustments'
import { seedDemoData } from '../../dev/seed'
import { registerFunctions } from '../functions'
import { migrate } from '../migrate'
import { migrations } from '../migrations'
import { createTestDb } from '../testing'
import { adjustBalances, updateAdjustment } from './adjustments'
import { createAccount, getAccount, setAccountArchived } from './accounts'
import { listCategories } from './categories'
import { getBalanceAt, getTotals } from './stats'
import { createTransaction, deleteTransaction, listTransactions } from './transactions'

const TODAY = '2026-10-26'

let db: Database.Database
let debit: number
let card: number

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
  const groceries = listCategories(db).find((c) => c.name === 'Groceries')
  if (!groceries) throw new Error('No Groceries category')
  createTransaction(db, {
    type: 'expense',
    title: 'Lidl',
    amount: 4550,
    date: '2026-10-10',
    accountId: debit,
    categoryId: groceries.id,
    note: null
  })
})

const balance = (id: number): number => getAccount(db, id, TODAY).balance

describe('adjustBalances', () => {
  it('sets each account to the balance typed', () => {
    // 1,000.00 − 45.50 = 954.50 in the app; the bank says 950.00.
    const added = adjustBalances(
      db,
      [
        { accountId: debit, balance: 95000 },
        { accountId: card, balance: -25000 }
      ],
      TODAY
    )
    expect(balance(debit)).toBe(95000)
    expect(balance(card)).toBe(-25000)
    expect(added.map((t) => [t.type, t.amount, t.date, t.title])).toEqual([
      ['adjustment_out', 450, TODAY, 'Balance adjustment'],
      ['adjustment_out', 5000, TODAY, 'Balance adjustment']
    ])
  })

  it('adds money in when the real balance is higher, and nothing when it matches', () => {
    const added = adjustBalances(
      db,
      [
        { accountId: debit, balance: 100000 },
        { accountId: card, balance: -20000 }
      ],
      TODAY
    )
    expect(added).toHaveLength(1)
    expect(added[0]).toMatchObject({ type: 'adjustment_in', amount: 4550, accountId: debit })
    expect(balance(debit)).toBe(100000)
  })

  it('is not income or spending, but moves the total balance', () => {
    const before = getTotals(db, { from: '2026-10-01', to: '2026-10-31' })
    adjustBalances(db, [{ accountId: debit, balance: 90000 }], TODAY)
    const after = getTotals(db, { from: '2026-10-01', to: '2026-10-31' })
    expect(after.income).toBe(before.income)
    expect(after.expenses).toBe(before.expenses)
    expect(getBalanceAt(db, TODAY)).toBe(90000 - 20000)
    // The transaction list's income and spending totals leave it out too.
    const page = listTransactions(db, { from: '2026-10-01', to: '2026-10-31' })
    expect(page.summary).toMatchObject({ count: 2, income: 0, expenses: 4550 })
  })

  it('refuses archived accounts and accounts that start later, changing nothing', () => {
    setAccountArchived(db, card, true)
    expect(() =>
      adjustBalances(
        db,
        [
          { accountId: debit, balance: 90000 },
          { accountId: card, balance: 0 }
        ],
        TODAY
      )
    ).toThrow(/archived/)
    expect(balance(debit)).toBe(95450)
    expect(() => adjustBalances(db, [{ accountId: debit, balance: 0 }], '2026-08-31')).toThrow(
      /starts on/
    )
  })
})

describe('updateAdjustment', () => {
  it('changes the amount, its direction and the date, and deletes like any transaction', () => {
    const [adjustment] = adjustBalances(db, [{ accountId: debit, balance: 95000 }], TODAY)
    const changed = updateAdjustment(db, adjustment.id, {
      amount: 1200,
      date: '2026-10-20',
      note: 'Bank interest'
    })
    expect(changed).toMatchObject({ type: 'adjustment_in', amount: 1200, note: 'Bank interest' })
    expect(adjustmentAmount(changed)).toBe(1200)
    expect(balance(debit)).toBe(95450 + 1200)

    expect(() =>
      updateAdjustment(db, adjustment.id, { amount: 0, date: TODAY, note: null })
    ).toThrow()
    expect(() =>
      updateAdjustment(db, adjustment.id, { amount: -100, date: '2026-08-01', note: null })
    ).toThrow(/starts on/)

    deleteTransaction(db, adjustment.id)
    expect(balance(debit)).toBe(95450)
  })

  it('only changes adjustments', () => {
    const [lidl] = listTransactions(db).items
    expect(() => updateAdjustment(db, lidl.id, { amount: 100, date: TODAY, note: null })).toThrow(
      /isn’t a balance adjustment/
    )
  })
})

describe('migration 005', () => {
  it('keeps every transaction and every index when it rebuilds the table', () => {
    const old = new Database(':memory:')
    old.pragma('foreign_keys = ON')
    registerFunctions(old)
    migrate(old, migrations.slice(0, 4))
    seedDemoData(old, TODAY)
    const rows = old.prepare('SELECT * FROM transactions ORDER BY id').all()
    const indexes = (): string[] =>
      (
        old
          .prepare(
            "SELECT name FROM sqlite_master WHERE tbl_name = 'transactions' AND type IN ('index', 'trigger') AND name NOT LIKE 'sqlite_%' ORDER BY name"
          )
          .all() as { name: string }[]
      ).map((r) => r.name)
    const before = indexes()

    migrate(old, migrations)
    expect(old.prepare('SELECT * FROM transactions ORDER BY id').all()).toEqual(rows)
    expect(indexes()).toEqual(before)
    expect(old.pragma('foreign_key_check')).toEqual([])
    expect(old.pragma('integrity_check', { simple: true })).toBe('ok')
  })
})
