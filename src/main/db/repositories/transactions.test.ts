import type Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import type { TransactionInput } from '@shared/transactions'
import { AppError } from '../../errors'
import { createTestDb } from '../testing'
import { createAccount, getAccount, setAccountArchived } from './accounts'
import { listCategories, updateCategory } from './categories'
import {
  createTransaction,
  deleteTransaction,
  getTransaction,
  listTransactions,
  updateTransaction
} from './transactions'

let db: Database.Database
let debit: number
let card: number

const categoryId = (name: string): number => {
  const category = listCategories(db).find((c) => c.name === name)
  if (!category) throw new Error(`No category ${name}`)
  return category.id
}

const expense = (overrides: Partial<TransactionInput> = {}): TransactionInput => ({
  type: 'expense',
  title: 'Lidl weekly shop',
  amount: 4250,
  date: '2026-10-20',
  accountId: debit,
  categoryId: categoryId('Groceries'),
  note: null,
  ...overrides
})

const expectAppError = (fn: () => unknown, code: AppError['code'], message?: RegExp): void => {
  try {
    fn()
  } catch (error) {
    expect(error).toBeInstanceOf(AppError)
    expect((error as AppError).code).toBe(code)
    if (message) expect((error as AppError).message).toMatch(message)
    return
  }
  throw new Error('Expected an AppError')
}

beforeEach(() => {
  db = createTestDb()
  debit = createAccount(db, {
    type: 'debit',
    name: 'Visa Debit',
    openingBalance: 100000,
    openingDate: '2026-01-01',
    color: 'blue'
  }).id
  card = createAccount(db, {
    type: 'credit',
    name: 'Mastercard',
    openingBalance: 0,
    openingDate: '2026-01-01',
    creditLimit: 300000,
    statementDay: null,
    paymentDueDay: null,
    color: 'orange'
  }).id
})

describe('createTransaction', () => {
  it('saves an expense and changes the account balance', () => {
    const tx = createTransaction(db, expense({ note: '  for the week  ' }))
    expect(tx).toMatchObject({
      type: 'expense',
      title: 'Lidl weekly shop',
      amount: 4250,
      date: '2026-10-20',
      accountId: debit,
      toAccountId: null,
      note: 'for the week'
    })
    expect(getAccount(db, debit, '2026-10-26').balance).toBe(100000 - 4250)
  })

  it('saves income', () => {
    createTransaction(
      db,
      expense({
        type: 'income',
        title: 'October salary',
        amount: 250000,
        categoryId: categoryId('Salary')
      })
    )
    expect(getAccount(db, debit, '2026-10-26').balance).toBe(350000)
  })

  it('uses the category name when the title is empty, and stores an empty note as null', () => {
    const tx = createTransaction(db, expense({ title: '   ', note: '  ' }))
    expect(tx.title).toBe('Groceries')
    expect(tx.note).toBeNull()
  })

  it('needs a category of the same type', () => {
    expectAppError(
      () => createTransaction(db, expense({ categoryId: categoryId('Salary') })),
      'validation',
      /income category\. Choose an expense category/
    )
  })

  it('refuses archived accounts and categories', () => {
    setAccountArchived(db, debit, true)
    expectAppError(() => createTransaction(db, expense()), 'validation', /archived/)
    setAccountArchived(db, debit, false)
    updateCategory(db, categoryId('Groceries'), { isArchived: true })
    expectAppError(() => createTransaction(db, expense()), 'validation', /archived/)
  })

  it('refuses dates before the account starts, naming the start date', () => {
    expectAppError(
      () => createTransaction(db, expense({ date: '2025-12-31' })),
      'validation',
      /starts on 1 Jan 2026/
    )
    expect(() => createTransaction(db, expense({ date: '2026-01-01' }))).not.toThrow()
  })

  it('reports missing accounts and categories', () => {
    expectAppError(() => createTransaction(db, expense({ accountId: 999 })), 'not_found')
    expectAppError(() => createTransaction(db, expense({ categoryId: 999 })), 'not_found')
  })

  it('validates the input', () => {
    expect(() => createTransaction(db, expense({ amount: 0 }))).toThrow(/above zero/)
    expect(() => createTransaction(db, expense({ amount: 12.5 }))).toThrow()
    expect(() => createTransaction(db, expense({ date: '20.10.2026' }))).toThrow(/date/)
    expect(() => createTransaction(db, expense({ title: 'x'.repeat(81) }))).toThrow(/80/)
    expect(() =>
      createTransaction(db, { ...expense(), type: 'transfer' } as unknown as TransactionInput)
    ).toThrow()
  })
})

describe('updateTransaction', () => {
  it('changes every field, moving the amount between accounts', () => {
    const { id } = createTransaction(db, expense())
    const updated = updateTransaction(
      db,
      id,
      expense({ title: 'Konzum', amount: 1000, date: '2026-10-21', accountId: card })
    )
    expect(updated).toMatchObject({
      title: 'Konzum',
      amount: 1000,
      date: '2026-10-21',
      accountId: card
    })
    expect(getAccount(db, debit, '2026-10-26').balance).toBe(100000)
    expect(getAccount(db, card, '2026-10-26').balance).toBe(-1000)
  })

  it('switches between income and expense with a matching category', () => {
    const { id } = createTransaction(db, expense())
    expect(
      updateTransaction(db, id, expense({ type: 'income', categoryId: categoryId('Other income') }))
        .type
    ).toBe('income')
  })

  it('keeps an archived category or account the transaction already uses', () => {
    const { id } = createTransaction(db, expense())
    updateCategory(db, categoryId('Groceries'), { isArchived: true })
    setAccountArchived(db, debit, true)
    expect(updateTransaction(db, id, expense({ amount: 999 })).amount).toBe(999)
  })

  it('keeps installment payments on their card', () => {
    const plan = db
      .prepare(
        `INSERT INTO installment_plans (account_id, title, category_id, total_amount, installments_count, first_date)
         VALUES (?, 'Laptop', ?, 100000, 5, '2026-06-01')`
      )
      .run(card, categoryId('Shopping')).lastInsertRowid
    const id = Number(
      db
        .prepare(
          `INSERT INTO transactions (date, title, amount, type, account_id, category_id, installment_plan_id, planned_date)
           VALUES ('2026-06-01', 'Laptop 1/5', 20000, 'expense', ?, ?, ?, '2026-06-01')`
        )
        .run(card, categoryId('Shopping'), plan).lastInsertRowid
    )
    const input = expense({
      accountId: card,
      categoryId: categoryId('Shopping'),
      date: '2026-06-01'
    })
    expect(() => updateTransaction(db, id, { ...input, title: 'Laptop, rate 1' })).not.toThrow()
    expect(getTransaction(db, id).installmentPlanId).toBe(Number(plan))
    expectAppError(() => updateTransaction(db, id, { ...input, accountId: debit }), 'validation')
  })

  it('only edits income and expenses', () => {
    const cash = createAccount(db, {
      type: 'cash',
      name: 'Wallet',
      openingBalance: 0,
      openingDate: '2026-01-01',
      color: 'olive'
    }).id
    const id = Number(
      db
        .prepare(
          `INSERT INTO transactions (date, title, amount, type, account_id, to_account_id)
           VALUES ('2026-10-20', 'ATM', 5000, 'transfer', ?, ?)`
        )
        .run(debit, cash).lastInsertRowid
    )
    expectAppError(
      () => updateTransaction(db, id, expense()),
      'validation',
      /Only income and expenses/
    )
  })
})

describe('deleteTransaction', () => {
  it('deletes and restores the balance', () => {
    const { id } = createTransaction(db, expense())
    deleteTransaction(db, id)
    expectAppError(() => getTransaction(db, id), 'not_found')
    expect(getAccount(db, debit, '2026-10-26').balance).toBe(100000)
    expectAppError(() => deleteTransaction(db, id), 'not_found')
  })
})

describe('listTransactions', () => {
  let cash: number

  beforeEach(() => {
    cash = createAccount(db, {
      type: 'cash',
      name: 'Wallet',
      openingBalance: 0,
      openingDate: '2026-01-01',
      color: 'olive'
    }).id
    createTransaction(db, expense({ date: '2026-10-01', title: 'Lidl', amount: 4250 }))
    createTransaction(
      db,
      expense({ date: '2026-10-01', title: 'Bakery', amount: 350, note: '50% off' })
    )
    createTransaction(
      db,
      expense({
        date: '2026-10-02',
        title: 'Pizza',
        amount: 1800,
        categoryId: categoryId('Eating out'),
        accountId: card
      })
    )
    createTransaction(
      db,
      expense({
        type: 'income',
        date: '2026-10-05',
        title: 'October salary',
        amount: 250000,
        categoryId: categoryId('Salary')
      })
    )
    db.prepare(
      `INSERT INTO transactions (date, title, amount, type, account_id, to_account_id)
       VALUES ('2026-10-03', 'ATM', 5000, 'transfer', ?, ?)`
    ).run(debit, cash)
  })

  const titles = (query: Parameters<typeof listTransactions>[1] = {}): string[] =>
    listTransactions(db, query).items.map((t) => t.title)

  it('lists newest first, latest added first within a day', () => {
    expect(titles()).toEqual(['October salary', 'ATM', 'Pizza', 'Bakery', 'Lidl'])
  })

  it('summarises income and expenses (not transfers) over all matches', () => {
    expect(listTransactions(db).summary).toEqual({ count: 5, income: 250000, expenses: 6400 })
  })

  it('totals each day on the page', () => {
    expect(listTransactions(db).dayTotals).toEqual([
      { date: '2026-10-05', income: 250000, expenses: 0 },
      { date: '2026-10-03', income: 0, expenses: 0 },
      { date: '2026-10-02', income: 0, expenses: 1800 },
      { date: '2026-10-01', income: 0, expenses: 4600 }
    ])
  })

  it('pages without gaps or repeats, even inside a day, with full day totals', () => {
    const first = listTransactions(db, { limit: 4 })
    expect(first.items.map((t) => t.title)).toEqual(['October salary', 'ATM', 'Pizza', 'Bakery'])
    expect(first.dayTotals.at(-1)).toEqual({ date: '2026-10-01', income: 0, expenses: 4600 })
    expect(first.next).not.toBeNull()

    const second = listTransactions(db, { limit: 4, after: first.next ?? undefined })
    expect(second.items.map((t) => t.title)).toEqual(['Lidl'])
    expect(second.next).toBeNull()
    expect(second.summary).toBeNull()
  })

  it('filters by date range, category and type', () => {
    expect(titles({ from: '2026-10-02', to: '2026-10-03' })).toEqual(['ATM', 'Pizza'])
    expect(titles({ categoryId: categoryId('Groceries') })).toEqual(['Bakery', 'Lidl'])
    expect(titles({ kind: 'income' })).toEqual(['October salary'])
    expect(titles({ kind: 'transfer' })).toEqual(['ATM'])
  })

  it('matches transfers on either account', () => {
    expect(titles({ accountId: cash })).toEqual(['ATM'])
    expect(titles({ accountId: card })).toEqual(['Pizza'])
    expect(titles({ accountId: debit })).toEqual(['October salary', 'ATM', 'Bakery', 'Lidl'])
  })

  it('searches title, note and category name, ignoring case', () => {
    expect(titles({ search: 'lidl' })).toEqual(['Lidl'])
    expect(titles({ search: 'eating' })).toEqual(['Pizza'])
    expect(titles({ search: '50%' })).toEqual(['Bakery'])
    expect(titles({ search: '5_%' })).toEqual([])
  })

  it('also matches an exact amount', () => {
    expect(titles({ search: '18', amount: 1800 })).toEqual(['Pizza'])
  })

  it('combines filters', () => {
    expect(titles({ search: 'a', kind: 'expense', accountId: debit })).toEqual(['Bakery'])
    expect(listTransactions(db, { kind: 'expense', accountId: debit }).summary).toEqual({
      count: 2,
      income: 0,
      expenses: 4600
    })
  })
})
