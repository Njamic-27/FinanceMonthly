import type Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import type { RecurringItemInput } from '@shared/recurring'
import { createTestDb } from '../db/testing'
import { createAccount, setAccountArchived } from '../db/repositories/accounts'
import { listCategories } from '../db/repositories/categories'
import { createRecurringItem } from '../db/repositories/recurring'
import { updateSettings } from '../db/repositories/settings'
import { createTransaction } from '../db/repositories/transactions'
import { calendarMonth, plannedItems, projectedBalance } from './planned'
import { postOccurrence, setItemActive } from './posting'

// Monday 26 October 2026.
const TODAY = '2026-10-26'

let db: Database.Database
let debit: number

const categoryId = (name: string): number =>
  listCategories(db).find((c) => c.name === name)?.id ?? 0

/** Rent on the last day of the month, next due 31 October. */
const rent = (overrides: Partial<RecurringItemInput> = {}): number =>
  createRecurringItem(db, {
    kind: 'expense',
    title: 'Rent',
    amount: 65000,
    accountId: debit,
    categoryId: categoryId('Rent'),
    frequency: 'monthly',
    interval: 1,
    anchorDate: '2026-07-31',
    nextDueDate: '2026-10-31',
    autoPost: false,
    reminderDaysBefore: null,
    ...overrides
  }).id

/** Salary on the 10th, next due 10 November. */
const salary = (): number =>
  createRecurringItem(db, {
    kind: 'income',
    title: 'Salary',
    amount: 245000,
    accountId: debit,
    categoryId: categoryId('Salary'),
    frequency: 'monthly',
    interval: 1,
    anchorDate: '2026-11-10',
    nextDueDate: '2026-11-10',
    autoPost: true,
    reminderDaysBefore: null
  }).id

const dates = (from: string, to: string): [string, string, boolean][] =>
  plannedItems(db, from, to, TODAY).map((p) => [p.title, p.date, p.overdue])

beforeEach(() => {
  db = createTestDb()
  debit = createAccount(db, {
    type: 'debit',
    name: 'Visa Debit',
    openingBalance: 100000,
    openingDate: '2026-01-01',
    color: 'blue'
  }).id
})

describe('plannedItems', () => {
  it('expands active items from their next due date on', () => {
    rent()
    salary()
    expect(dates('2026-10-01', '2026-12-31')).toEqual([
      ['Rent', '2026-10-31', false],
      ['Salary', '2026-11-10', false],
      ['Rent', '2026-11-30', false],
      ['Salary', '2026-12-10', false],
      ['Rent', '2026-12-31', false]
    ])
    expect(plannedItems(db, '2026-11-10', '2026-11-10', TODAY)[0]).toMatchObject({
      source: 'recurring',
      amount: 245000,
      group: 'income',
      accountId: debit,
      categoryId: categoryId('Salary')
    })
  })

  it('marks unsettled payments before today overdue', () => {
    rent({ nextDueDate: '2026-09-30' })
    expect(dates('2026-09-01', '2026-10-31')).toEqual([
      ['Rent', '2026-09-30', true],
      ['Rent', '2026-10-31', false]
    ])
  })

  it('leaves out payments already settled, such as one paid early', () => {
    const id = rent()
    postOccurrence(db, {
      itemId: id,
      plannedDate: '2026-11-30',
      date: TODAY,
      amount: 65000,
      accountId: debit
    })
    expect(dates('2026-10-01', '2026-12-31').map(([, date]) => date)).toEqual([
      '2026-10-31',
      '2026-12-31'
    ])
  })

  it('leaves out paused items and stops at the end date', () => {
    const paused = rent({ title: 'Gym' })
    setItemActive(db, paused, false, TODAY)
    rent({ endDate: '2026-11-30' })
    expect(dates('2026-10-01', '2027-03-31')).toEqual([
      ['Rent', '2026-10-31', false],
      ['Rent', '2026-11-30', false]
    ])
  })
})

describe('projectedBalance', () => {
  it('adds what is planned up to the date to the balance then', () => {
    rent()
    salary()
    // 1,000 opening − 650 (31 Oct) + 2,450 (10 Nov) − 650 (30 Nov)
    expect(projectedBalance(db, '2026-11-30', TODAY)).toBe(215000)
    expect(projectedBalance(db, '2026-10-30', TODAY)).toBe(100000)
  })

  it('counts overdue payments and transactions already entered for later', () => {
    rent({ nextDueDate: '2026-09-30' })
    createTransaction(db, {
      type: 'expense',
      title: 'Concert tickets',
      amount: 8000,
      date: '2026-10-29',
      accountId: debit,
      categoryId: categoryId('Entertainment'),
      note: null
    })
    // 1,000 − 650 (overdue) − 80 (entered for the 29th) − 650 (31 Oct)
    expect(projectedBalance(db, '2026-10-31', TODAY)).toBe(-38000)
  })

  it('leaves out payments into archived accounts, like the total balance', () => {
    const cash = createAccount(db, {
      type: 'cash',
      name: 'Wallet',
      openingBalance: 0,
      openingDate: '2026-01-01',
      color: 'olive'
    }).id
    rent({ accountId: cash })
    setAccountArchived(db, cash, true)
    expect(projectedBalance(db, '2026-12-31', TODAY)).toBe(100000)
  })
})

describe('calendarMonth', () => {
  it('covers whole weeks from the first day of the week', () => {
    updateSettings(db, { weekStart: 1 })
    const october = calendarMonth(db, { month: '2026-10-15' }, TODAY)
    expect(october.month).toEqual({ start: '2026-10-01', end: '2026-10-31' })
    expect(october.grid).toEqual({ start: '2026-09-28', end: '2026-11-01' })
    expect(october.days).toHaveLength(35)
    expect(october.days[0].date).toBe('2026-09-28')

    updateSettings(db, { weekStart: 0 })
    expect(calendarMonth(db, { month: '2026-10-15' }, TODAY).grid).toEqual({
      start: '2026-09-27',
      end: '2026-10-31'
    })
  })

  it('sums the month and projects its ending balance', () => {
    rent({ nextDueDate: '2026-09-30' })
    salary()
    createTransaction(db, {
      type: 'expense',
      title: 'Groceries',
      amount: 4250,
      date: '2026-10-20',
      accountId: debit,
      categoryId: categoryId('Groceries'),
      note: null
    })
    const { summary, days, planned } = calendarMonth(db, { month: TODAY }, TODAY)
    expect(summary).toEqual({
      income: 0,
      expenses: 4250,
      plannedIncome: 0,
      plannedExpenses: 65000,
      overdue: 0,
      // 1,000 − 42.50 − 650 (overdue 30 Sep) − 650 (31 Oct)
      endingBalance: 100000 - 4250 - 65000 - 65000,
      projected: true
    })
    expect(days.find((d) => d.date === '2026-10-20')).toMatchObject({ expenses: 4250, count: 1 })
    // The grid runs from 28 Sep to 1 Nov: the overdue rent shows, the 10 Nov salary doesn't.
    expect(planned.map((p) => p.date)).toEqual(['2026-09-30', '2026-10-31'])
  })

  it('shows what a past month actually ended with, and counts its overdue payments', () => {
    rent({ nextDueDate: '2026-09-30' })
    const { summary } = calendarMonth(db, { month: '2026-09-01' }, TODAY)
    expect(summary).toMatchObject({
      plannedExpenses: 65000,
      overdue: 1,
      endingBalance: 100000,
      projected: false
    })
  })

  it('goes up to 24 months ahead', () => {
    expect(calendarMonth(db, { month: '2028-10-31' }, TODAY).month.start).toBe('2028-10-01')
    expect(() => calendarMonth(db, { month: '2028-11-01' }, TODAY)).toThrow(/goes up to/)
  })
})
