import type Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { createTestDb } from '../db/testing'
import { createAccount, getAccount, updateAccount } from '../db/repositories/accounts'
import { listCategories } from '../db/repositories/categories'
import { createInstallmentPlan } from '../db/repositories/installments'
import { updateSettings } from '../db/repositories/settings'
import { getCategoryTotals, getSeries, getTotals } from '../db/repositories/stats'
import {
  createTransaction,
  getTransaction,
  listTransactions,
  updateTransaction
} from '../db/repositories/transactions'
import { monthSheet, setMonthCell } from './monthSheet'
import { calendarMonth } from './planned'
import { postDueInstallments } from './posting'

// Card spending counts in the month the card is paid (PLAN.md §2, step 42).

const TODAY = '2026-12-20'
const NOVEMBER = { from: '2026-11-01', to: '2026-11-30' }

let db: Database.Database
let debit: number
let card: number

const categoryId = (name: string): number => {
  const category = listCategories(db).find((c) => c.name === name)
  if (!category) throw new Error(`No category ${name}`)
  return category.id
}

const buy = (date: string, amount: number, accountId = card, category = 'Groceries'): number =>
  createTransaction(db, {
    type: 'expense',
    title: '',
    amount,
    date,
    accountId,
    categoryId: categoryId(category),
    note: null
  }).id

const countsOn = (id: number): string => getTransaction(db, id).countsOn

beforeEach(() => {
  db = createTestDb()
  debit = createAccount(db, {
    type: 'debit',
    name: 'Visa Debit',
    openingBalance: 500000,
    openingDate: '2026-01-01',
    color: 'blue'
  }).id
  card = createAccount(db, {
    type: 'credit',
    name: 'Mastercard',
    openingBalance: 0,
    openingDate: '2026-01-01',
    color: 'orange',
    creditLimit: 300000,
    statementDay: 25,
    paymentDueDay: 15
  }).id
})

describe('the day card spending counts', () => {
  it('is the due date of the bill the purchase is on', () => {
    expect(countsOn(buy('2026-10-20', 4000))).toBe('2026-11-15')
    expect(countsOn(buy('2026-10-25', 4000))).toBe('2026-11-15')
    // After the statement day: the following bill.
    expect(countsOn(buy('2026-10-26', 4000))).toBe('2026-12-15')
    // Everything else counts on its date.
    expect(countsOn(buy('2026-10-20', 4000, debit))).toBe('2026-10-20')
  })

  it('follows a purchase that moves to another day or account', () => {
    const lidl = buy('2026-10-20', 4000)
    const input = {
      type: 'expense' as const,
      title: 'Lidl',
      amount: 4000,
      accountId: card,
      categoryId: categoryId('Groceries'),
      note: null
    }
    updateTransaction(db, lidl, { ...input, date: '2026-10-28' })
    expect(countsOn(lidl)).toBe('2026-12-15')
    updateTransaction(db, lidl, { ...input, date: '2026-10-28', accountId: debit })
    expect(countsOn(lidl)).toBe('2026-10-28')
  })

  it('puts each installment on the bill that includes it', () => {
    createInstallmentPlan(db, {
      accountId: card,
      title: 'Laptop',
      categoryId: categoryId('Shopping'),
      totalAmount: 90000,
      count: 3,
      firstDate: '2026-10-20',
      note: null
    })
    postDueInstallments(db, TODAY)
    const rates = listTransactions(db, { categoryId: categoryId('Shopping') }).items
    expect(rates.map((t) => [t.date, t.countsOn]).sort()).toEqual([
      ['2026-10-20', '2026-11-15'],
      ['2026-11-20', '2026-12-15'],
      ['2026-12-20', '2027-01-15']
    ])
  })

  it('moves when the card’s days or the setting change, without counting as an edit', () => {
    const lidl = buy('2026-10-20', 4000)
    const updatedAt = getTransaction(db, lidl).updatedAt
    const account = getAccount(db, card)
    updateAccount(db, card, {
      type: 'credit',
      name: account.name,
      openingBalance: account.openingBalance,
      openingDate: account.openingDate,
      color: account.color,
      creditLimit: 300000,
      statementDay: 10,
      paymentDueDay: 1
    })
    // Statement 10 November, due 1 December.
    expect(countsOn(lidl)).toBe('2026-12-01')

    updateSettings(db, { cardSpendingMonth: 'purchase' })
    expect(countsOn(lidl)).toBe('2026-10-20')
    updateSettings(db, { cardSpendingMonth: 'payment' })
    expect(countsOn(lidl)).toBe('2026-12-01')
    expect(getTransaction(db, lidl).updatedAt).toBe(updatedAt)
  })
})

describe('counting by the bill', () => {
  beforeEach(() => {
    buy('2026-10-20', 4000) // on the bill due 15 November
    buy('2026-11-03', 2500, debit) // November, paid straight away
    buy('2026-11-10', 1500) // on the bill due 15 December
    // Paying the card is moving money, never spending.
    createTransaction(db, {
      type: 'transfer',
      title: '',
      amount: 4000,
      date: '2026-11-15',
      accountId: debit,
      toAccountId: card,
      note: null
    })
  })

  it('gives every screen the same November', () => {
    const expected = 4000 + 2500
    expect(getTotals(db, NOVEMBER).expenses).toBe(expected)
    expect(calendarMonth(db, { month: '2026-11-01' }, TODAY).summary.expenses).toBe(expected)
    const months = getSeries(db, { from: '2026-10-01', to: '2026-12-31', by: 'month' })
    expect(months.map((m) => m.expenses)).toEqual([0, expected, 1500])
    expect(getCategoryTotals(db, { ...NOVEMBER, type: 'expense' })).toEqual([
      { categoryId: categoryId('Groceries'), total: expected, count: 2 }
    ])
    expect(listTransactions(db, NOVEMBER).summary).toMatchObject({ expenses: expected })
    const groceries = monthSheet(db, { month: '2026-11' }, TODAY)
      .sections.flatMap((s) => s.rows)
      .find((r) => r.kind === 'category' && r.sourceId === categoryId('Groceries'))
    expect(groceries).toMatchObject({ actual: expected, count: 2 })
  })

  it('keeps real dates for balances and for what happened on a day', () => {
    // The card owed 40.00 from 20 October, the day of the purchase.
    expect(getAccount(db, card, '2026-10-20').balance).toBe(-4000)
    const days = getSeries(db, { from: '2026-10-20', to: '2026-10-20', by: 'day' }, 'actual')
    expect(days[0].expenses).toBe(4000)
    expect(
      listTransactions(db, { from: '2026-10-20', to: '2026-10-20', dates: 'actual' }).items
    ).toHaveLength(1)
  })

  it('counts a typed amount in its own month, even on the card', () => {
    setMonthCell(
      db,
      {
        month: '2026-10',
        kind: 'category',
        sourceId: categoryId('Transport'),
        amount: 6000,
        accountId: card
      },
      TODAY
    )
    expect(getTotals(db, { from: '2026-10-01', to: '2026-10-31' }).expenses).toBe(6000)
  })

  it('counts by the day of purchase when that’s the setting', () => {
    updateSettings(db, { cardSpendingMonth: 'purchase' })
    const months = getSeries(db, { from: '2026-10-01', to: '2026-12-31', by: 'month' })
    expect(months.map((m) => m.expenses)).toEqual([4000, 2500 + 1500, 0])
  })
})
