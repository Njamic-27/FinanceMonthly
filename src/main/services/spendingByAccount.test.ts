import type Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { createTestDb } from '../db/testing'
import { createAccount } from '../db/repositories/accounts'
import { listCategories } from '../db/repositories/categories'
import { createInstallmentPlan } from '../db/repositories/installments'
import { createRecurringItem } from '../db/repositories/recurring'
import { createTransaction } from '../db/repositories/transactions'
import { setMonthCell } from './monthSheet'
import { calendarMonth } from './planned'
import { postDueInstallments } from './posting'
import { spendingByAccount } from './spendingByAccount'

const TODAY = '2026-11-10'

let db: Database.Database
let debit: number
let cash: number
let card: number

const categoryId = (name: string): number => {
  const category = listCategories(db).find((c) => c.name === name)
  if (!category) throw new Error(`No category ${name}`)
  return category.id
}

const buy = (date: string, amount: number, accountId: number): void => {
  createTransaction(db, {
    type: 'expense',
    title: '',
    amount,
    date,
    accountId,
    categoryId: categoryId('Groceries'),
    note: null
  })
}

/** The month's expenses as the sheet shows them: recorded, plus planned from this month on. */
const expenses = (month: string): number => {
  const { summary } = calendarMonth(db, { month: `${month}-01` }, TODAY)
  return summary.expenses + (summary.projected ? summary.plannedExpenses : 0)
}

const total = (month: string): number =>
  spendingByAccount(db, { month }, TODAY).reduce((sum, a) => sum + a.recorded + a.planned, 0)

beforeEach(() => {
  db = createTestDb()
  const account = (name: string, type: 'debit' | 'cash'): number =>
    createAccount(db, {
      type,
      name,
      openingBalance: 500000,
      openingDate: '2026-01-01',
      color: 'blue'
    }).id
  debit = account('Visa Debit', 'debit')
  cash = account('Wallet', 'cash')
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

  buy('2026-10-20', 4000, card) // last cycle: on the bill due 15 November
  buy('2026-11-05', 1500, card) // this cycle: due 15 December
  buy('2026-11-03', 2500, debit)
  // Rates on 30 September (after the 25th: due 15 November), 30 October (15 December) and
  // 30 November (15 January).
  createInstallmentPlan(db, {
    accountId: card,
    title: 'Laptop',
    categoryId: categoryId('Shopping'),
    totalAmount: 30000,
    count: 3,
    firstDate: '2026-09-30',
    note: null
  })
  postDueInstallments(db, TODAY)
  // Typed on the sheet, paid in cash.
  setMonthCell(
    db,
    {
      month: '2026-11',
      kind: 'category',
      sourceId: categoryId('Transport'),
      amount: 3000,
      accountId: cash
    },
    TODAY
  )
  // Rent, still to pay on 20 November.
  createRecurringItem(db, {
    kind: 'expense',
    title: 'Rent',
    amount: 65000,
    accountId: debit,
    categoryId: categoryId('Rent'),
    frequency: 'monthly',
    interval: 1,
    anchorDate: '2026-11-20',
    nextDueDate: '2026-11-20',
    autoPost: false,
    reminderDaysBefore: null
  })
})

describe('spendingByAccount', () => {
  it('splits the month’s spending by the account it was paid with', () => {
    const november = spendingByAccount(db, { month: '2026-11' }, TODAY).sort(
      (a, b) => a.accountId - b.accountId
    )
    expect(november).toEqual([
      { accountId: debit, recorded: 2500, planned: 65000, count: 1 },
      { accountId: cash, recorded: 3000, planned: 0, count: 1 },
      // October's purchase and the 30 September rate, on the bill due 15 November.
      { accountId: card, recorded: 4000 + 10000, planned: 0, count: 2 }
    ])
  })

  it('adds up to the month’s expenses, past, current and future', () => {
    for (const month of ['2026-10', '2026-11', '2026-12', '2027-01']) {
      expect(total(month)).toBe(expenses(month))
    }
    // December: this cycle's purchase and the October rate; January: the last rate, planned.
    expect(spendingByAccount(db, { month: '2026-12' }, TODAY)).toContainEqual({
      accountId: card,
      recorded: 1500 + 10000,
      planned: 0,
      count: 2
    })
    expect(
      spendingByAccount(db, { month: '2027-01' }, TODAY).find((a) => a.accountId === card)
    ).toMatchObject({ planned: 10000 })
  })
})
