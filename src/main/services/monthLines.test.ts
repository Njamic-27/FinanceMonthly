import type Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import type { MonthLineInput, MonthSheetRow } from '@shared/month'
import { createTestDb } from '../db/testing'
import { createAccount } from '../db/repositories/accounts'
import { listCategories, updateCategory } from '../db/repositories/categories'
import { getInstallmentPlan } from '../db/repositories/installments'
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
    expect(section('everyday')).toEqual([
      expect.objectContaining({ title: 'Groceries', actual: 25000, summary: 0, accountId: cash })
    ])
    const [tx] = listTransactions(db, { categoryId: categoryId('Groceries') }).items
    expect(tx).toMatchObject({ date: '2026-10-12', amount: 25000, title: 'Groceries' })

    // Another one adds to it.
    add({ name: 'Groceries', amount: 4000, accountId: cash, title: 'Market' })
    expect(section('everyday')[0]).toMatchObject({ actual: 29000, count: 2 })
  })

  it('creates a category for a new name, and restores an archived one', () => {
    add({ name: 'Bike repairs', type: 'expense' })
    expect(listCategories(db).find((c) => c.name === 'Bike repairs')?.type).toBe('expense')
    expect(titles('everyday')).toEqual(['Bike repairs'])

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
    // A recurring expense goes with its category's group: a new category is Everyday.
    expect(section('everyday')).toEqual([
      expect.objectContaining({ kind: 'recurring', title: 'Gym', planned: 3500 })
    ])
    expect(section('everyday', '2026-11')[0]).toMatchObject({ planned: 3500 })
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
      section('everyday', month).find((r) => r.title === 'Car insurance')
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

describe('adding from a group (step 51)', () => {
  it('creates a subcategory in the group it was added from', () => {
    add({ name: 'Streaming', group: 'subscriptions', amount: 1500 })
    expect(listCategories(db).find((c) => c.name === 'Streaming')?.group).toBe('subscriptions')
    expect(titles('subscriptions')).toEqual(['Streaming'])
    expect(titles('everyday')).toEqual([])
    const netflix = add({
      name: 'Streaming',
      title: 'Netflix',
      amount: 1399,
      repeat: { frequency: 'monthly', interval: 1 }
    })
    expect(getRecurringItem(db, netflix.sourceId)).toMatchObject({
      kind: 'subscription',
      title: 'Netflix'
    })
    // An existing category keeps its own group.
    add({ name: 'Groceries', group: 'bills' })
    expect(listCategories(db).find((c) => c.name === 'Groceries')?.group).toBe('everyday')
  })

  it('buys on a card in installments', () => {
    const card = createAccount(db, {
      type: 'credit',
      name: 'Mastercard',
      openingBalance: 0,
      openingDate: '2026-01-01',
      color: 'orange',
      creditLimit: 300000,
      statementDay: 25,
      paymentDueDay: 15,
      payFromAccountId: debit
    }).id
    const row = add({
      name: 'Shopping',
      title: 'PlayStation',
      amount: 60000,
      accountId: card,
      date: '2026-10-20',
      installments: 6
    })
    expect(row.kind).toBe('installment_plan')
    expect(getInstallmentPlan(db, row.sourceId)).toMatchObject({
      title: 'PlayStation',
      totalAmount: 60000,
      count: 6,
      categoryId: categoryId('Shopping')
    })
    // The first rate is charged straight away and counts with the bill in November.
    expect(listTransactions(db, { accountId: card }).items).toEqual([
      expect.objectContaining({
        date: '2026-10-20',
        amount: 10000,
        installmentPlanId: row.sourceId
      })
    ])
    expect(section('everyday', '2026-11')).toEqual([
      expect.objectContaining({ kind: 'installment_plan', title: 'PlayStation', actual: 10000 })
    ])
    expect(section('everyday', '2026-12')[0]).toMatchObject({ planned: 10000 })

    // Only on a card, once, and with an amount.
    expect(() => add({ amount: 60000, installments: 6 })).toThrow(/credit card/)
    expect(() =>
      add({
        amount: 60000,
        accountId: card,
        installments: 6,
        repeat: { frequency: 'monthly', interval: 1 }
      })
    ).toThrow(/one-time/)
  })

  it('repeats every 4 months, up to every 24', () => {
    const row = add({
      name: 'Water',
      group: 'bills',
      amount: 4500,
      date: '2026-11-10',
      repeat: { frequency: 'monthly', interval: 4 }
    })
    expect(getRecurringItem(db, row.sourceId)).toMatchObject({ frequency: 'monthly', interval: 4 })
    const water = (month: string): number | undefined =>
      section('bills', month).find((r) => r.title === 'Water')?.planned
    expect(
      ['2026-11', '2026-12', '2027-01', '2027-02', '2027-03'].map((month) => water(month))
    ).toEqual([4500, undefined, undefined, undefined, 4500])

    expect(
      add({ name: 'Passport', amount: 1000, repeat: { frequency: 'monthly', interval: 24 } })
    ).toMatchObject({ kind: 'recurring' })
    expect(() =>
      add({ name: 'Passport', amount: 1000, repeat: { frequency: 'monthly', interval: 25 } })
    ).toThrow(/24 or fewer/)
  })
})

describe('hiding a row', () => {
  it('leaves it out of months without its transactions, until it’s added again', () => {
    add({ name: 'Groceries' })
    buy('Groceries', '2026-09-10')
    hideMonthRow(db, { categoryId: categoryId('Groceries'), hidden: true }, TODAY)
    expect(titles('everyday')).toEqual([])
    expect(titles('everyday', '2026-09')).toEqual(['Groceries'])

    add({ name: 'Groceries' })
    expect(titles('everyday')).toEqual(['Groceries'])
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
    expect(titles('everyday')).toEqual(['Food'])

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
    add({ name: 'Health' })
    buy('Transport')
    expect(titles('everyday')).toEqual(['Groceries', 'Health', 'Transport'])

    const ids = ['Transport', 'Groceries', 'Health'].map(categoryId)
    reorderMonthRows(db, { type: 'expense', categoryIds: ids }, TODAY)
    expect(titles('everyday')).toEqual(['Transport', 'Groceries', 'Health'])
    expect(listMonthRows(db).map((r) => r.categoryId)).toEqual(ids)
  })

  it('keeps rows within their section', () => {
    expect(() =>
      reorderMonthRows(db, { type: 'expense', categoryIds: [categoryId('Bonus')] }, TODAY)
    ).toThrow(/own section/)
  })
})
