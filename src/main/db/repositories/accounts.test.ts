import type Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import type { AccountInput } from '@shared/accounts'
import { AppError } from '../../errors'
import { createTestDb } from '../testing'
import {
  createAccount,
  deleteAccount,
  getAccount,
  listAccounts,
  setAccountArchived,
  updateAccount
} from './accounts'

let db: Database.Database

beforeEach(() => {
  db = createTestDb()
})

const debit: AccountInput = {
  type: 'debit',
  name: 'Visa Debit',
  openingBalance: 150000,
  openingDate: '2026-01-01',
  color: 'blue'
}
const cash: AccountInput = {
  type: 'cash',
  name: 'Wallet',
  openingBalance: 5000,
  openingDate: '2026-01-01',
  color: 'olive'
}
const card: AccountInput = {
  type: 'credit',
  name: 'Mastercard',
  openingBalance: -20000,
  openingDate: '2026-01-01',
  creditLimit: 300000,
  statementDay: 25,
  paymentDueDay: 15,
  color: 'orange'
}

const categoryId = (name: string): number =>
  (db.prepare('SELECT id FROM categories WHERE name = ?').get(name) as { id: number }).id

let goalId: number
let loanId: number

function addTx(tx: {
  type: string
  amount: number
  account: number
  to?: number
  date?: string
}): void {
  const isIncome = tx.type === 'income'
  const needsCategory = tx.type === 'income' || tx.type === 'expense'
  db.prepare(
    `INSERT INTO transactions (date, title, amount, type, account_id, to_account_id, category_id, savings_goal_id, loan_id)
     VALUES (?, 'Test', ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    tx.date ?? '2026-06-01',
    tx.amount,
    tx.type,
    tx.account,
    tx.to ?? null,
    needsCategory ? categoryId(isIncome ? 'Salary' : 'Groceries') : null,
    tx.type.startsWith('savings_') ? goalId : null,
    tx.type.startsWith('loan_') ? loanId : null
  )
}

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

describe('createAccount', () => {
  it('creates each type in order, with credit fields only on cards', () => {
    createAccount(db, debit)
    createAccount(db, cash)
    createAccount(db, card)
    const accounts = listAccounts(db, '2026-10-26')
    expect(accounts.map((a) => a.name)).toEqual(['Visa Debit', 'Wallet', 'Mastercard'])
    expect(accounts[0]).toMatchObject({
      type: 'debit',
      balance: 150000,
      creditLimit: null,
      available: null,
      isArchived: false,
      usageCount: 0
    })
    expect(accounts[2]).toMatchObject({
      type: 'credit',
      balance: -20000,
      creditLimit: 300000,
      statementDay: 25,
      paymentDueDay: 15,
      available: 280000
    })
  })

  it('rejects a duplicate name, ignoring case', () => {
    createAccount(db, debit)
    expectAppError(
      () => createAccount(db, { ...cash, name: 'visa debit' }),
      'conflict',
      /already have an account/
    )
  })

  it('validates per type', () => {
    expect(() => createAccount(db, { ...debit, name: ' ' })).toThrow(/name/)
    expect(() => createAccount(db, { ...debit, openingDate: '2026-02-30' })).toThrow(/date/)
    expect(() => createAccount(db, { ...cash, openingBalance: -1 })).toThrow(/below zero/)
    expect(() => createAccount(db, { ...card, openingBalance: 100 })).toThrow(/owe/)
    expect(() => createAccount(db, { ...card, creditLimit: 0 })).toThrow(/limit/)
    expect(() => createAccount(db, { ...card, statementDay: 32 })).toThrow(/1 to 31/)
    expect(() => createAccount(db, { ...debit, openingBalance: 1.5 })).toThrow()
    expect(() =>
      createAccount(db, { ...debit, creditLimit: 1000 } as unknown as AccountInput)
    ).toThrow()
  })

  it('allows an overdrawn debit account', () => {
    expect(createAccount(db, { ...debit, openingBalance: -5000 }).balance).toBe(-5000)
  })
})

describe('balance', () => {
  let d: number, c: number, cc: number

  beforeEach(() => {
    d = createAccount(db, debit).id
    c = createAccount(db, cash).id
    cc = createAccount(db, card).id
    goalId = Number(
      db.prepare("INSERT INTO savings_goals (name, target_amount) VALUES ('Holiday', 100000)").run()
        .lastInsertRowid
    )
    loanId = Number(
      db
        .prepare(
          "INSERT INTO loans (kind, title, counterparty, principal, start_date) VALUES ('lent', 'Loan', 'Ana', 10000, '2026-01-01')"
        )
        .run().lastInsertRowid
    )
  })

  const balanceOf = (id: number, asOf = '2026-10-26'): number => getAccount(db, id, asOf).balance

  it('adds money in and subtracts money out by type', () => {
    addTx({ type: 'income', amount: 250000, account: d })
    addTx({ type: 'expense', amount: 4000, account: d })
    addTx({ type: 'savings_deposit', amount: 10000, account: d })
    addTx({ type: 'savings_withdrawal', amount: 3000, account: d })
    addTx({ type: 'loan_out', amount: 10000, account: d })
    addTx({ type: 'loan_in', amount: 2500, account: d })
    expect(balanceOf(d)).toBe(150000 + 250000 - 4000 - 10000 + 3000 - 10000 + 2500)
  })

  it('moves transfers between accounts', () => {
    addTx({ type: 'transfer', amount: 20000, account: d, to: c }) // ATM withdrawal
    addTx({ type: 'transfer', amount: 15000, account: d, to: cc }) // card payment
    expect(balanceOf(d)).toBe(150000 - 20000 - 15000)
    expect(balanceOf(c)).toBe(5000 + 20000)
    expect(balanceOf(cc)).toBe(-20000 + 15000)
  })

  it('makes card spending debt and shrinks what is available', () => {
    addTx({ type: 'expense', amount: 50000, account: cc })
    expect(getAccount(db, cc, '2026-10-26')).toMatchObject({
      balance: -70000,
      available: 230000
    })
  })

  it('counts transactions from the opening date up to the as-of date only', () => {
    addTx({ type: 'expense', amount: 1000, account: d, date: '2025-12-31' }) // before opening
    addTx({ type: 'expense', amount: 2000, account: d, date: '2026-01-01' }) // opening day
    addTx({ type: 'expense', amount: 4000, account: d, date: '2026-10-26' }) // today
    addTx({ type: 'expense', amount: 8000, account: d, date: '2026-10-27' }) // future
    expect(balanceOf(d)).toBe(150000 - 2000 - 4000)
    expect(balanceOf(d, '2026-10-27')).toBe(150000 - 2000 - 4000 - 8000)
    expect(balanceOf(d, '2025-12-31')).toBe(150000)
  })

  it('counts every linked row as a use', () => {
    addTx({ type: 'transfer', amount: 100, account: d, to: c })
    expect(getAccount(db, c).usageCount).toBe(1)
    expect(getAccount(db, d).usageCount).toBe(1)
  })
})

describe('updateAccount', () => {
  it('saves every field and clears credit fields when a card becomes another type', () => {
    const id = createAccount(db, card).id
    const updated = updateAccount(db, id, { ...debit, name: 'Old card', openingBalance: 0 })
    expect(updated).toMatchObject({
      type: 'debit',
      name: 'Old card',
      creditLimit: null,
      statementDay: null,
      paymentDueDay: null,
      available: null
    })
  })

  it('keeps its own name, in any case', () => {
    const id = createAccount(db, debit).id
    expect(updateAccount(db, id, { ...debit, name: 'VISA DEBIT' }).name).toBe('VISA DEBIT')
  })

  it('keeps a card with installment plans a credit card', () => {
    const id = createAccount(db, card).id
    db.prepare(
      `INSERT INTO installment_plans (account_id, title, category_id, total_amount, installments_count, first_date)
       VALUES (?, 'Laptop', ?, 100000, 5, '2026-06-01')`
    ).run(id, categoryId('Shopping'))
    expectAppError(() => updateAccount(db, id, debit), 'validation', /stay a credit card/)
  })

  it('reports a missing account', () => {
    expectAppError(() => updateAccount(db, 999, debit), 'not_found')
  })
})

describe('archive and delete', () => {
  it('archives and restores', () => {
    const id = createAccount(db, debit).id
    expect(setAccountArchived(db, id, true).isArchived).toBe(true)
    expect(setAccountArchived(db, id, false).isArchived).toBe(false)
  })

  it('deletes only an unused account', () => {
    const used = createAccount(db, debit).id
    const unused = createAccount(db, cash).id
    addTx({ type: 'expense', amount: 100, account: used })
    expectAppError(() => deleteAccount(db, used), 'conflict', /Archive it instead/)
    deleteAccount(db, unused)
    expectAppError(() => getAccount(db, unused), 'not_found')
  })
})
