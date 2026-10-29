import type Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import type { MonthLineInput, MonthSheetRow } from '@shared/month'
import { createTestDb } from '../db/testing'
import { createAccount } from '../db/repositories/accounts'
import { listCategories, updateCategory } from '../db/repositories/categories'
import { listMonthRows } from '../db/repositories/monthRows'
import { getRecurringItem } from '../db/repositories/recurring'
import { createSavingsGoal, getSavingsGoal } from '../db/repositories/savings'
import { createTransaction, listTransactions } from '../db/repositories/transactions'
import { addMonthLine, hideMonthRow, renameMonthRow, reorderMonthRows } from './monthLines'
import { monthSheet } from './monthSheet'

const TODAY = '2026-10-27'

let db: Database.Database
let debit: number
let cash: number

const categoryId = (name: string): number =>
  listCategories(db).find((c) => c.name === name)?.id ?? 0

const section = (key: string, month = '2026-10'): MonthSheetRow[] =>
  monthSheet(db, { month }, TODAY).sections.find((s) => s.key === key)?.rows ?? []

const titles = (key: string, month = '2026-10'): string[] => section(key, month).map((r) => r.title)

const add = (input: Partial<MonthLineInput> = {}): { kind: string; sourceId: number } =>
  addMonthLine(
    db,
    {
      month: '2026-10',
      type: 'expense',
      name: 'Fuel',
      amount: 0,
      accountId: debit,
      date: '2026-10-12',
      repeat: null,
      ...input
    },
    TODAY
  )

const buy = (category: string, date = '2026-10-10'): void => {
  createTransaction(db, {
    type: 'expense',
    title: '',
    amount: 1000,
    date,
    accountId: debit,
    categoryId: categoryId(category),
    note: null
  })
}

beforeEach(() => {
  db = createTestDb()
  const account = (name: string, type: 'debit' | 'cash'): number =>
    createAccount(db, {
      type,
      name,
      openingBalance: 100000,
      openingDate: '2026-01-01',
      color: 'blue'
    }).id
  debit = account('Visa Debit', 'debit')
  cash = account('Wallet', 'cash')
})

describe('adding a row', () => {
  it('reuses a category by name, adding a one-time transaction on its date', () => {
    const before = listCategories(db).length
    const row = add({ name: 'groceries', amount: 25000, accountId: cash })
    expect(row).toEqual({ kind: 'category', sourceId: categoryId('Groceries') })
    expect(listCategories(db)).toHaveLength(before)
    expect(section('expenses')).toEqual([
      expect.objectContaining({ title: 'Groceries', actual: 25000, summary: 0, accountId: cash })
    ])
    const [tx] = listTransactions(db, { categoryId: categoryId('Groceries') }).items
    expect(tx).toMatchObject({ date: '2026-10-12', amount: 25000, title: 'Groceries' })

    // Another one adds to it.
    add({ name: 'Groceries', amount: 4000, accountId: cash, title: 'Market' })
    expect(section('expenses')[0]).toMatchObject({ actual: 29000, count: 2 })
  })

  it('creates a category for a new name, and restores an archived one', () => {
    add({ name: 'Bike repairs', type: 'expense' })
    expect(listCategories(db).find((c) => c.name === 'Bike repairs')?.type).toBe('expense')
    expect(titles('expenses')).toEqual(['Bike repairs'])

    updateCategory(db, categoryId('Bonus'), { isArchived: true })
    add({ name: 'Bonus', type: 'income', amount: 50000 })
    expect(listCategories(db).find((c) => c.name === 'Bonus')?.isArchived).toBe(false)
    expect(section('income')[0]).toMatchObject({ title: 'Bonus', actual: 50000 })
  })

  it('makes a monthly recurring item', () => {
    const row = add({
      name: 'Gym',
      amount: 3500,
      date: '2026-10-30',
      repeat: { frequency: 'monthly', interval: 1 }
    })
    expect(row.kind).toBe('recurring')
    expect(getRecurringItem(db, row.sourceId)).toMatchObject({
      title: 'Gym',
      amount: 3500,
      frequency: 'monthly',
      nextDueDate: '2026-10-30'
    })
    // A recurring expense is a bill, not everyday spending.
    expect(section('bills')).toEqual([
      expect.objectContaining({ kind: 'recurring', title: 'Gym', planned: 3500 })
    ])
    expect(section('bills', '2026-11')[0]).toMatchObject({ planned: 3500 })
    // Not added as a category row as well.
    expect(listMonthRows(db)).toEqual([])
  })

  it('repeats every week, every few months or every year, under its own name', () => {
    const weekly = add({
      name: 'Groceries',
      title: 'Market',
      amount: 2000,
      date: '2026-10-05',
      repeat: { frequency: 'weekly', interval: 1 }
    })
    expect(getRecurringItem(db, weekly.sourceId)).toMatchObject({
      title: 'Market',
      categoryId: categoryId('Groceries'),
      frequency: 'weekly',
      interval: 1
    })
    const quarterly = add({
      name: 'Car insurance',
      amount: 12000,
      date: '2026-11-15',
      repeat: { frequency: 'monthly', interval: 3 }
    })
    expect(getRecurringItem(db, quarterly.sourceId)).toMatchObject({
      title: 'Car insurance',
      frequency: 'monthly',
      interval: 3,
      nextDueDate: '2026-11-15'
    })
    // Every third month from November: not in December or January.
    const insurance = (month: string): MonthSheetRow | undefined =>
      section('bills', month).find((r) => r.title === 'Car insurance')
    expect(insurance('2026-11')).toMatchObject({ planned: 12000 })
    expect(insurance('2026-12')).toBeUndefined()
    expect(insurance('2027-01')).toBeUndefined()
    expect(insurance('2027-02')).toMatchObject({ planned: 12000 })

    const yearly = add({
      name: 'Bonus',
      type: 'income',
      amount: 100000,
      date: '2026-12-20',
      repeat: { frequency: 'yearly', interval: 1 }
    })
    expect(getRecurringItem(db, yearly.sourceId)).toMatchObject({
      kind: 'income',
      frequency: 'yearly'
    })
  })

  it('needs an amount for a recurring line', () => {
    expect(() => add({ repeat: { frequency: 'monthly', interval: 1 } })).toThrow(/amount each time/)
  })
})

describe('hiding a row', () => {
  it('leaves it out of months without its transactions, until it’s added again', () => {
    add({ name: 'Groceries' })
    buy('Groceries', '2026-09-10')
    hideMonthRow(db, { categoryId: categoryId('Groceries'), hidden: true }, TODAY)
    expect(titles('expenses')).toEqual([])
    expect(titles('expenses', '2026-09')).toEqual(['Groceries'])

    add({ name: 'Groceries' })
    expect(titles('expenses')).toEqual(['Groceries'])
  })

  it('works on a row shown only for its transactions', () => {
    buy('Transport', '2026-09-10')
    hideMonthRow(db, { categoryId: categoryId('Transport'), hidden: true }, TODAY)
    expect(listMonthRows(db)).toEqual([
      expect.objectContaining({ categoryId: categoryId('Transport'), isHidden: true })
    ])
  })
})

describe('renaming a row', () => {
  it('renames its category, recurring item or goal', () => {
    add({ name: 'Groceries' })
    renameMonthRow(db, { kind: 'category', sourceId: categoryId('Groceries'), name: 'Food' })
    expect(titles('expenses')).toEqual(['Food'])

    const gym = add({
      name: 'Gym',
      amount: 3500,
      date: '2026-10-30',
      repeat: { frequency: 'monthly', interval: 1 }
    })
    renameMonthRow(db, { kind: 'recurring', sourceId: gym.sourceId, name: 'Fitness' })
    expect(getRecurringItem(db, gym.sourceId).title).toBe('Fitness')

    const goal = createSavingsGoal(db, {
      name: 'Holiday',
      targetAmount: 100000,
      targetDate: null,
      startingAmount: 0,
      plannedMonthly: null,
      color: 'blue'
    })
    renameMonthRow(db, { kind: 'savings', sourceId: goal.id, name: 'Summer' })
    expect(getSavingsGoal(db, goal.id).name).toBe('Summer')
  })

  it('refuses a name another category has', () => {
    expect(() =>
      renameMonthRow(db, { kind: 'category', sourceId: categoryId('Groceries'), name: 'rent' })
    ).toThrow(/already/)
  })
})

describe('reordering rows', () => {
  it('puts the section in the new order, adding rows shown only for their transactions', () => {
    add({ name: 'Groceries' })
    add({ name: 'Rent' })
    buy('Transport')
    expect(titles('expenses')).toEqual(['Groceries', 'Rent', 'Transport'])

    const ids = ['Transport', 'Groceries', 'Rent'].map(categoryId)
    reorderMonthRows(db, { type: 'expense', categoryIds: ids }, TODAY)
    expect(titles('expenses')).toEqual(['Transport', 'Groceries', 'Rent'])
    expect(listMonthRows(db).map((r) => r.categoryId)).toEqual(ids)
  })

  it('keeps rows within their section', () => {
    expect(() =>
      reorderMonthRows(db, { type: 'expense', categoryIds: [categoryId('Bonus')] }, TODAY)
    ).toThrow(/own section/)
  })
})
