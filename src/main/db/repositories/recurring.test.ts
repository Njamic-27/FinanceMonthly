import type Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import type { RecurringItemInput } from '@shared/recurring'
import { createTestDb } from '../testing'
import { createAccount, setAccountArchived } from './accounts'
import { listCategories } from './categories'
import {
  createRecurringItem,
  deleteRecurringItem,
  getRecurringItem,
  listRecurringItems,
  updateRecurringItem
} from './recurring'
import { createPlannedTransaction, getTransaction } from './transactions'

let db: Database.Database
let debit: number

const categoryId = (name: string): number =>
  listCategories(db).find((c) => c.name === name)?.id ?? 0

const salary = (overrides: Partial<RecurringItemInput> = {}): RecurringItemInput => ({
  kind: 'income',
  title: 'Salary',
  amount: 245000,
  accountId: debit,
  categoryId: categoryId('Salary'),
  frequency: 'monthly',
  interval: 1,
  anchorDate: '2026-10-31',
  nextDueDate: '2026-11-30',
  autoPost: true,
  reminderDaysBefore: null,
  ...overrides
})

beforeEach(() => {
  db = createTestDb()
  debit = createAccount(db, {
    type: 'debit',
    name: 'Visa Debit',
    openingBalance: 0,
    openingDate: '2026-01-01',
    color: 'blue'
  }).id
})

describe('createRecurringItem', () => {
  it('saves a monthly salary', () => {
    expect(createRecurringItem(db, salary())).toMatchObject({
      kind: 'income',
      title: 'Salary',
      amount: 245000,
      frequency: 'monthly',
      interval: 1,
      anchorDate: '2026-10-31',
      nextDueDate: '2026-11-30',
      autoPost: true,
      isActive: true,
      endDate: null
    })
    expect(listRecurringItems(db)).toHaveLength(1)
  })

  it('needs a category of the matching type', () => {
    expect(() => createRecurringItem(db, salary({ categoryId: categoryId('Rent') }))).toThrow(
      /income category/
    )
    expect(() =>
      createRecurringItem(db, salary({ kind: 'subscription', categoryId: categoryId('Salary') }))
    ).toThrow(/expense category/)
  })

  it('refuses archived accounts and inconsistent dates', () => {
    expect(() => createRecurringItem(db, salary({ nextDueDate: '2026-10-30' }))).toThrow(
      /can’t be before/
    )
    setAccountArchived(db, debit, true)
    expect(() => createRecurringItem(db, salary())).toThrow(/archived/)
  })

  it('validates the input', () => {
    expect(() => createRecurringItem(db, salary({ title: ' ' }))).toThrow(/name/)
    expect(() => createRecurringItem(db, salary({ amount: 0 }))).toThrow(/above zero/)
    expect(() => createRecurringItem(db, salary({ anchorDate: '31.10.2026' }))).toThrow()
    expect(() => createRecurringItem(db, salary({ nextDueDate: '2026-11-29' }))).toThrow(
      /doesn’t fall on this schedule/
    )
    expect(() => createRecurringItem(db, salary({ endDate: '2026-11-01' }))).toThrow(/end date/)
  })

  it('saves an end date, a note and a website', () => {
    const item = createRecurringItem(
      db,
      salary({ endDate: '2027-06-30', note: '  Until the contract ends ', url: 'example.com/pay' })
    )
    expect(item).toMatchObject({
      endDate: '2027-06-30',
      note: 'Until the contract ends',
      url: 'https://example.com/pay',
      postedCount: 0
    })
    expect(updateRecurringItem(db, item.id, salary({ url: null })).url).toBeNull()
  })
})

describe('updateRecurringItem', () => {
  it('replaces the details and schedule', () => {
    const { id } = createRecurringItem(db, salary())
    expect(
      updateRecurringItem(
        db,
        id,
        salary({ amount: 260000, anchorDate: '2026-12-15', nextDueDate: '2026-12-15' })
      )
    ).toMatchObject({ amount: 260000, anchorDate: '2026-12-15', nextDueDate: '2026-12-15' })
  })

  it('keeps an archived account it already uses', () => {
    const { id } = createRecurringItem(db, salary())
    setAccountArchived(db, debit, true)
    expect(updateRecurringItem(db, id, salary({ amount: 1 })).amount).toBe(1)
  })

  it('stays income or spending once it has posted', () => {
    const { id } = createRecurringItem(db, salary())
    const rent = { kind: 'expense', categoryId: categoryId('Rent') } as const
    expect(updateRecurringItem(db, id, salary(rent)).kind).toBe('expense')
    updateRecurringItem(db, id, salary())

    createPlannedTransaction(
      db,
      {
        type: 'income',
        title: 'Salary',
        amount: 245000,
        date: '2026-11-30',
        accountId: debit,
        categoryId: categoryId('Salary'),
        note: null
      },
      { recurringItemId: id, plannedDate: '2026-11-30' }
    )
    expect(() => updateRecurringItem(db, id, salary(rent))).toThrow(/stays income/)
  })
})

describe('deleteRecurringItem', () => {
  it('keeps the transactions it posted, unlinked', () => {
    const { id } = createRecurringItem(db, salary())
    const tx = createPlannedTransaction(
      db,
      {
        type: 'income',
        title: 'Salary',
        amount: 245000,
        date: '2026-11-30',
        accountId: debit,
        categoryId: categoryId('Salary'),
        note: null
      },
      { recurringItemId: id, plannedDate: '2026-11-30' }
    )
    expect(getRecurringItem(db, id).postedCount).toBe(1)

    deleteRecurringItem(db, id)
    expect(listRecurringItems(db)).toEqual([])
    expect(getTransaction(db, tx.id)).toMatchObject({
      amount: 245000,
      recurringItemId: null,
      plannedDate: null
    })
    expect(() => deleteRecurringItem(db, id)).toThrow(/no longer exists/)
  })
})
