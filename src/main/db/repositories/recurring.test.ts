import type Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import type { RecurringItemInput } from '@shared/recurring'
import { createTestDb } from '../testing'
import { createAccount, setAccountArchived } from './accounts'
import { listCategories } from './categories'
import { createRecurringItem, listRecurringItems } from './recurring'

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
  })
})
