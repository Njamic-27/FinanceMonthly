import type Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { hasEnded, type RecurringItemInput } from '@shared/recurring'
import { createTestDb } from '../db/testing'
import { createAccount, setAccountArchived } from '../db/repositories/accounts'
import { listCategories } from '../db/repositories/categories'
import { createRecurringItem, getRecurringItem } from '../db/repositories/recurring'
import {
  createTransaction,
  deleteTransaction,
  listTransactions
} from '../db/repositories/transactions'
import {
  cancelItem,
  dueOccurrences,
  postDueItems,
  postOccurrence,
  setItemActive,
  skipOccurrence,
  syncItem
} from './posting'

let db: Database.Database
let debit: number
let cash: number

const categoryId = (name: string): number =>
  listCategories(db).find((c) => c.name === name)?.id ?? 0

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
    nextDueDate: '2026-08-31',
    autoPost: true,
    reminderDaysBefore: null,
    ...overrides
  }).id

const posted = (): { date: string; plannedDate: string | null; amount: number }[] =>
  listTransactions(db)
    .items.map(({ date, plannedDate, amount }) => ({ date, plannedDate, amount }))
    .reverse()

beforeEach(() => {
  db = createTestDb()
  const account = (name: string, type: 'debit' | 'cash'): number =>
    createAccount(db, {
      type,
      name,
      openingBalance: 0,
      openingDate: '2026-01-01',
      color: 'blue'
    }).id
  debit = account('Visa Debit', 'debit')
  cash = account('Wallet', 'cash')
})

describe('postDueItems', () => {
  it('posts every occurrence due by today and moves the next due date on', () => {
    const id = rent()
    expect(postDueItems(db, '2026-10-26')).toBe(2)
    expect(posted()).toEqual([
      { date: '2026-08-31', plannedDate: '2026-08-31', amount: 65000 },
      { date: '2026-09-30', plannedDate: '2026-09-30', amount: 65000 }
    ])
    expect(listTransactions(db).items[0]).toMatchObject({
      type: 'expense',
      title: 'Rent',
      recurringItemId: id,
      categoryId: categoryId('Rent')
    })
    expect(getRecurringItem(db, id).nextDueDate).toBe('2026-10-31')
  })

  it('posts nothing twice', () => {
    rent()
    postDueItems(db, '2026-10-26')
    expect(postDueItems(db, '2026-10-26')).toBe(0)
    expect(postDueItems(db, '2026-10-31')).toBe(1)
    expect(posted()).toHaveLength(3)
  })

  it('posts on the due day itself', () => {
    const id = rent({ nextDueDate: '2026-10-31', anchorDate: '2026-10-31' })
    expect(postDueItems(db, '2026-10-30')).toBe(0)
    expect(postDueItems(db, '2026-10-31')).toBe(1)
    expect(getRecurringItem(db, id).nextDueDate).toBe('2026-11-30')
  })

  it('leaves items that ask first, paused items and future items alone', () => {
    const asks = rent({ autoPost: false })
    rent({ title: 'Parking' })
    const paused = rent({ title: 'Gym' })
    db.prepare('UPDATE recurring_items SET is_active = 0 WHERE id = ?').run(paused)
    rent({ title: 'Later', anchorDate: '2026-11-05', nextDueDate: '2026-11-05' })

    expect(postDueItems(db, '2026-10-26')).toBe(2)
    expect(listTransactions(db).items.every((t) => t.title === 'Parking')).toBe(true)
    expect(getRecurringItem(db, asks).nextDueDate).toBe('2026-08-31')
    expect(getRecurringItem(db, paused).nextDueDate).toBe('2026-08-31')
  })

  it('stops at the end date and marks the item ended', () => {
    const id = rent({ endDate: '2026-09-30' })
    expect(postDueItems(db, '2026-12-31')).toBe(2)
    expect(getRecurringItem(db, id).nextDueDate).toBe('2026-10-31')
    expect(dueOccurrences(db, '2026-12-31')).toEqual([])
  })

  it('keeps an occurrence it can’t post due, with the reason', () => {
    const id = rent()
    setAccountArchived(db, debit, true)
    expect(postDueItems(db, '2026-10-26')).toBe(0)
    expect(getRecurringItem(db, id).nextDueDate).toBe('2026-08-31')
    const due = dueOccurrences(db, '2026-10-26')
    expect(due.map((d) => d.plannedDate)).toEqual(['2026-08-31', '2026-09-30'])
    expect(due[0].problem).toMatch(/archived/)
  })

  it('posts occurrences after one that falls before the account opened', () => {
    db.prepare('UPDATE accounts SET opening_date = ? WHERE id = ?').run('2026-09-01', debit)
    const id = rent()
    expect(postDueItems(db, '2026-10-26')).toBe(1)
    expect(getRecurringItem(db, id).nextDueDate).toBe('2026-08-31')
    expect(dueOccurrences(db, '2026-10-26').map((d) => d.plannedDate)).toEqual(['2026-08-31'])
  })
})

describe('dueOccurrences', () => {
  it('lists items that ask first, oldest first', () => {
    const a = rent({ autoPost: false })
    const b = rent({
      autoPost: false,
      title: 'Phone',
      anchorDate: '2026-09-15',
      nextDueDate: '2026-09-15'
    })
    expect(
      dueOccurrences(db, '2026-10-26').map((d) => [d.item.id, d.plannedDate, d.problem])
    ).toEqual([
      [a, '2026-08-31', null],
      [b, '2026-09-15', null],
      [a, '2026-09-30', null],
      [b, '2026-10-15', null]
    ])
  })
})

describe('postOccurrence', () => {
  it('posts with the confirmed amount, account and date', () => {
    const id = rent({ autoPost: false })
    const tx = postOccurrence(db, {
      itemId: id,
      plannedDate: '2026-08-31',
      date: '2026-09-02',
      amount: 66000,
      accountId: cash
    })
    expect(tx).toMatchObject({
      date: '2026-09-02',
      plannedDate: '2026-08-31',
      amount: 66000,
      accountId: cash,
      title: 'Rent',
      recurringItemId: id
    })
    expect(getRecurringItem(db, id).nextDueDate).toBe('2026-09-30')
  })

  it('can post a later occurrence first, or one paid early', () => {
    const id = rent({ autoPost: false })
    const confirm = (plannedDate: string): unknown =>
      postOccurrence(db, {
        itemId: id,
        plannedDate,
        date: plannedDate,
        amount: 65000,
        accountId: debit
      })

    confirm('2026-09-30')
    expect(getRecurringItem(db, id).nextDueDate).toBe('2026-08-31')
    confirm('2026-08-31')
    expect(getRecurringItem(db, id).nextDueDate).toBe('2026-10-31')
    confirm('2026-10-31')
    expect(getRecurringItem(db, id).nextDueDate).toBe('2026-11-30')
  })

  it('refuses dates off the schedule and occurrences already settled', () => {
    const id = rent({ autoPost: false })
    const confirm = (plannedDate: string): unknown =>
      postOccurrence(db, {
        itemId: id,
        plannedDate,
        date: plannedDate,
        amount: 65000,
        accountId: debit
      })

    expect(() => confirm('2026-09-01')).toThrow(/isn’t due/)
    confirm('2026-08-31')
    expect(() => confirm('2026-08-31')).toThrow(/already posted/)
    expect(() => confirm('2026-07-31')).toThrow(/already posted/)
  })

  it('checks the account like any transaction', () => {
    const id = rent({ autoPost: false })
    setAccountArchived(db, cash, true)
    expect(() =>
      postOccurrence(db, {
        itemId: id,
        plannedDate: '2026-08-31',
        date: '2026-08-31',
        amount: 65000,
        accountId: cash
      })
    ).toThrow(/archived/)
    expect(posted()).toEqual([])
  })
})

describe('skipOccurrence', () => {
  it('skips the next due occurrence without posting', () => {
    const id = rent({ autoPost: false })
    expect(skipOccurrence(db, id, '2026-08-31').nextDueDate).toBe('2026-09-30')
    expect(posted()).toEqual([])
    expect(() => skipOccurrence(db, id, '2026-10-31')).toThrow(/earlier/)
    expect(() => skipOccurrence(db, id, '2026-08-31')).toThrow(/already posted or skipped/)
  })

  it('jumps over occurrences already posted', () => {
    const id = rent({ autoPost: false })
    postOccurrence(db, {
      itemId: id,
      plannedDate: '2026-09-30',
      date: '2026-09-30',
      amount: 65000,
      accountId: debit
    })
    expect(skipOccurrence(db, id, '2026-08-31').nextDueDate).toBe('2026-10-31')
  })
})

describe('syncItem', () => {
  it('posts what an automatic item already owes', () => {
    const id = rent()
    rent({ title: 'Other' })
    expect(syncItem(db, id, '2026-10-26').nextDueDate).toBe('2026-10-31')
    expect(listTransactions(db).items.map((t) => t.title)).toEqual(['Rent', 'Rent'])
  })
})

it('does not post an occurrence again after its transaction is deleted', () => {
  const id = rent()
  postDueItems(db, '2026-10-26')
  const [latest] = listTransactions(db).items
  deleteTransaction(db, latest.id)
  expect(postDueItems(db, '2026-10-26')).toBe(0)
  expect(getRecurringItem(db, id).nextDueDate).toBe('2026-10-31')
  // An ordinary transaction never settles a planned occurrence.
  createTransaction(db, {
    type: 'expense',
    title: 'Rent',
    amount: 65000,
    date: '2026-10-31',
    accountId: debit,
    categoryId: categoryId('Rent'),
    note: null
  })
  expect(postDueItems(db, '2026-10-31')).toBe(1)
})

describe('setItemActive', () => {
  it('posts nothing while paused and leaves out what fell due meanwhile', () => {
    const id = rent({ anchorDate: '2026-10-31', nextDueDate: '2026-10-31' })
    setItemActive(db, id, false, '2026-10-26')
    expect(postDueItems(db, '2027-01-15')).toBe(0)
    expect(dueOccurrences(db, '2027-01-15')).toEqual([])

    const resumed = setItemActive(db, id, true, '2027-01-15')
    expect(resumed).toMatchObject({ isActive: true, nextDueDate: '2027-01-31' })
    expect(posted()).toEqual([])
  })

  it('posts a payment due on the day it resumes', () => {
    const id = rent({ anchorDate: '2026-10-31', nextDueDate: '2026-10-31' })
    setItemActive(db, id, false, '2026-10-26')
    expect(setItemActive(db, id, true, '2026-11-30').nextDueDate).toBe('2026-12-31')
    expect(posted()).toEqual([{ date: '2026-11-30', plannedDate: '2026-11-30', amount: 65000 }])
  })

  it('keeps the next date when resumed before it', () => {
    const id = rent({ anchorDate: '2026-10-31', nextDueDate: '2026-10-31' })
    setItemActive(db, id, false, '2026-10-26')
    expect(setItemActive(db, id, true, '2026-10-28').nextDueDate).toBe('2026-10-31')
  })
})

describe('cancelItem', () => {
  it('ends it today, so nothing after today is posted', () => {
    const id = rent({ nextDueDate: '2026-10-31' })
    const cancelled = cancelItem(db, id, '2026-10-26')
    expect(cancelled).toMatchObject({ endDate: '2026-10-26', nextDueDate: '2026-10-31' })
    expect(hasEnded(cancelled)).toBe(true)
    expect(postDueItems(db, '2027-01-01')).toBe(0)
  })

  it('keeps payments already due waiting', () => {
    const id = rent({ autoPost: false })
    const cancelled = cancelItem(db, id, '2026-10-26')
    expect(hasEnded(cancelled)).toBe(false)
    expect(dueOccurrences(db, '2026-12-31').map((d) => d.plannedDate)).toEqual([
      '2026-08-31',
      '2026-09-30'
    ])
    skipOccurrence(db, id, '2026-08-31')
    expect(hasEnded(skipOccurrence(db, id, '2026-09-30'))).toBe(true)
  })

  it('ends one that hasn’t started before its first payment', () => {
    const id = rent({ anchorDate: '2026-12-05', nextDueDate: '2026-12-05' })
    const cancelled = cancelItem(db, id, '2026-10-26')
    expect(cancelled).toMatchObject({ endDate: '2026-12-05', nextDueDate: '2027-01-05' })
    expect(hasEnded(cancelled)).toBe(true)
    expect(postDueItems(db, '2027-06-01')).toBe(0)
  })
})
