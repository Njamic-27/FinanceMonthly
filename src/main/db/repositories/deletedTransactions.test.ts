import type Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { postDueItems } from '../../services/posting'
import { createTestDb } from '../testing'
import { createAccount, deleteAccount } from './accounts'
import { listCategories } from './categories'
import { createRecurringItem } from './recurring'
import {
  createTransaction,
  deleteTransaction,
  getTransaction,
  listTransactions,
  restoreTransaction
} from './transactions'

// Deleting a transaction can be undone: it comes back as it was.

let db: Database.Database
let debit: number

const groceries = (): number => listCategories(db).find((c) => c.name === 'Groceries')?.id ?? 0

const buy = (title: string, accountId = debit): number =>
  createTransaction(db, {
    type: 'expense',
    title,
    amount: 2500,
    date: '2026-10-12',
    accountId,
    categoryId: groceries(),
    note: 'market'
  }).id

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

describe('deleting a transaction', () => {
  it('can be undone, bringing it back as it was', () => {
    buy('Lidl')
    const id = buy('Konzum')
    const before = getTransaction(db, id)
    const deletedId = deleteTransaction(db, id)
    expect(listTransactions(db, {}).items.map((t) => t.title)).toEqual(['Lidl'])

    expect(restoreTransaction(db, deletedId)).toEqual(before)
    // Once only.
    expect(() => restoreTransaction(db, deletedId)).toThrow(/can’t be undone any more/)
  })

  it('brings back a recurring payment with its planned date', () => {
    const item = createRecurringItem(db, {
      kind: 'expense',
      title: 'Gym',
      amount: 3500,
      accountId: debit,
      categoryId: groceries(),
      frequency: 'monthly',
      interval: 1,
      anchorDate: '2026-10-05',
      nextDueDate: '2026-10-05',
      autoPost: true,
      reminderDaysBefore: null
    })
    postDueItems(db, '2026-10-06')
    const [posted] = listTransactions(db, {}).items
    expect(posted).toMatchObject({ recurringItemId: item.id, plannedDate: '2026-10-05' })

    const back = restoreTransaction(db, deleteTransaction(db, posted.id))
    expect(back).toMatchObject({ recurringItemId: item.id, plannedDate: '2026-10-05' })
  })

  it('takes a new id when its own was used since', () => {
    const id = buy('Konzum')
    const deletedId = deleteTransaction(db, id)
    expect(buy('Spar')).toBe(id)
    const back = restoreTransaction(db, deletedId)
    expect(back.id).not.toBe(id)
    expect(back.title).toBe('Konzum')
  })

  it('can’t bring it back once its account is gone', () => {
    const wallet = createAccount(db, {
      type: 'cash',
      name: 'Wallet',
      openingBalance: 0,
      openingDate: '2026-01-01',
      color: 'olive'
    }).id
    const deletedId = deleteTransaction(db, buy('Kiosk', wallet))
    deleteAccount(db, wallet)
    expect(() => restoreTransaction(db, deletedId)).toThrow(/can’t be put back/)
  })

  it('keeps the last 50 to bring back', () => {
    const first = deleteTransaction(db, buy('First'))
    for (let i = 0; i < 50; i += 1) deleteTransaction(db, buy(`Shop ${i}`))
    expect(() => restoreTransaction(db, first)).toThrow(/can’t be undone any more/)
  })
})
