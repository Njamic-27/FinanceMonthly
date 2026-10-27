import type Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import type { PersonalLoanInput, RepaymentInput } from '@shared/loans'
import { createTestDb } from '../testing'
import { createAccount, getAccount, setAccountArchived } from './accounts'
import {
  addRepayment,
  createPersonalLoan,
  deleteLoan,
  deleteRepayment,
  getLoan,
  listLoans,
  listLoanTransactions,
  reopenLoan,
  settleLoan,
  updatePersonalLoan,
  updateRepayment
} from './loans'

let db: Database.Database
let debit: number
let cash: number

const lend = (overrides: Partial<PersonalLoanInput> = {}): number =>
  createPersonalLoan(db, {
    kind: 'lent',
    counterparty: 'Marko',
    title: '',
    principal: 30000,
    startDate: '2026-05-06',
    dueDate: '2027-01-06',
    createDisbursementTx: true,
    accountId: debit,
    note: null,
    ...overrides
  }).id

const repay = (loanId: number, overrides: Partial<RepaymentInput> = {}): number =>
  addRepayment(db, {
    loanId,
    amount: 10000,
    accountId: cash,
    date: '2026-08-22',
    note: null,
    ...overrides
  }).id

const balance = (account: number): number => getAccount(db, account, '2027-12-31').balance

beforeEach(() => {
  db = createTestDb()
  debit = createAccount(db, {
    type: 'debit',
    name: 'Visa Debit',
    openingBalance: 100000,
    openingDate: '2026-01-01',
    color: 'blue'
  }).id
  cash = createAccount(db, {
    type: 'cash',
    name: 'Wallet',
    openingBalance: 0,
    openingDate: '2026-01-01',
    color: 'olive'
  }).id
})

describe('createPersonalLoan', () => {
  it('records money lent, leaving the account', () => {
    const id = lend()
    expect(getLoan(db, id)).toMatchObject({
      kind: 'lent',
      title: 'Loan to Marko',
      counterparty: 'Marko',
      principal: 30000,
      status: 'active',
      repaid: 0,
      outstanding: 30000
    })
    expect(listLoanTransactions(db, id).map((t) => [t.type, t.title, t.amount, t.date])).toEqual([
      ['loan_out', 'Loan to Marko', 30000, '2026-05-06']
    ])
    expect(balance(debit)).toBe(70000)
  })

  it('records money borrowed, arriving in the account', () => {
    const id = lend({ kind: 'borrowed', counterparty: 'Ana' })
    expect(getLoan(db, id).title).toBe('Loan from Ana')
    expect(listLoanTransactions(db, id)[0].type).toBe('loan_in')
    expect(balance(debit)).toBe(130000)
  })

  it('can leave the money moving unrecorded', () => {
    const id = lend({ createDisbursementTx: false, accountId: null })
    expect(listLoanTransactions(db, id)).toEqual([])
    expect(balance(debit)).toBe(100000)
  })

  it('validates', () => {
    expect(() => lend({ counterparty: ' ' })).toThrow(/Who/)
    expect(() => lend({ dueDate: '2026-05-01' })).toThrow(/due date/)
    expect(() => lend({ accountId: null })).toThrow(/Choose an account/)
    expect(() => lend({ startDate: '2025-12-31' })).toThrow(/starts on/)
    setAccountArchived(db, cash, true)
    expect(() => lend({ accountId: cash })).toThrow(/archived/)
  })
})

describe('repayments', () => {
  it('bring money back and lower what is owed', () => {
    const id = lend()
    repay(id)
    expect(getLoan(db, id)).toMatchObject({
      repaid: 10000,
      outstanding: 20000,
      repaymentCount: 1,
      lastRepaymentDate: '2026-08-22',
      status: 'active'
    })
    expect(listLoanTransactions(db, id)[0]).toMatchObject({
      type: 'loan_in',
      title: 'Marko paid back',
      accountId: cash
    })
    expect(balance(cash)).toBe(10000)
  })

  it('go out of your account on money you borrowed', () => {
    const id = lend({ kind: 'borrowed', counterparty: 'Ana' })
    repay(id, { accountId: debit })
    expect(listLoanTransactions(db, id)[0]).toMatchObject({
      type: 'loan_out',
      title: 'Paid back Ana'
    })
    expect(balance(debit)).toBe(120000)
  })

  it('never exceed what is owed, nor come before the loan', () => {
    const id = lend()
    expect(() => repay(id, { amount: 30001 })).toThrow(/Only €300.00 is still owed/)
    expect(() => repay(id, { date: '2026-05-05' })).toThrow(/started on/)
  })

  it('pay the loan off at zero, and reopen it when undone', () => {
    const id = lend()
    const first = repay(id)
    const last = repay(id, { amount: 20000, date: '2026-09-01' })
    expect(getLoan(db, id)).toMatchObject({ status: 'paid_off', outstanding: 0 })
    expect(() => repay(id, { amount: 1 })).toThrow(/paid off/)

    deleteRepayment(db, last)
    expect(getLoan(db, id)).toMatchObject({ status: 'active', outstanding: 20000 })
    updateRepayment(db, first, {
      loanId: id,
      amount: 30000,
      accountId: debit,
      date: '2026-08-23',
      note: 'All at once'
    })
    expect(getLoan(db, id)).toMatchObject({ status: 'paid_off', repaid: 30000 })
  })
})

describe('settling', () => {
  it('records the rest as paid back', () => {
    const id = lend()
    repay(id)
    expect(
      settleLoan(db, id, { how: 'repaid', accountId: debit, date: '2026-10-01' })
    ).toMatchObject({ status: 'paid_off', repaid: 30000, outstanding: 0 })
    expect(listLoanTransactions(db, id)[0]).toMatchObject({ amount: 20000, date: '2026-10-01' })
  })

  it('writes the rest off without moving money, and reopens', () => {
    const id = lend()
    repay(id)
    expect(settleLoan(db, id, { how: 'forgiven' })).toMatchObject({
      status: 'written_off',
      outstanding: 0,
      repaid: 10000
    })
    expect(listLoanTransactions(db, id)).toHaveLength(2)
    expect(reopenLoan(db, id)).toMatchObject({ status: 'active', outstanding: 20000 })
  })
})

describe('updatePersonalLoan', () => {
  const edit = (id: number, changes: Partial<PersonalLoanInput>): void => {
    updatePersonalLoan(db, id, {
      kind: 'lent',
      counterparty: 'Marko',
      title: '',
      principal: 30000,
      startDate: '2026-05-06',
      dueDate: '2027-01-06',
      createDisbursementTx: true,
      accountId: debit,
      note: null,
      ...changes
    })
  }

  it('keeps the starting transaction in step', () => {
    const id = lend()
    edit(id, { principal: 40000, startDate: '2026-05-10', accountId: cash })
    expect(listLoanTransactions(db, id).map((t) => [t.amount, t.date, t.accountId])).toEqual([
      [40000, '2026-05-10', cash]
    ])
    edit(id, { principal: 40000, createDisbursementTx: false, accountId: null })
    expect(listLoanTransactions(db, id)).toEqual([])
  })

  it('refuses less than was paid back, or switching sides after a repayment', () => {
    const id = lend()
    repay(id)
    expect(() => edit(id, { principal: 9999 })).toThrow(/at least that much/)
    expect(() => edit(id, { kind: 'borrowed' })).toThrow(/stays a loan you lent/)
    edit(id, { principal: 10000 })
    expect(getLoan(db, id).status).toBe('paid_off')
  })
})

describe('deleteLoan', () => {
  it('removes the loan and every transaction for it', () => {
    const id = lend()
    repay(id)
    deleteLoan(db, id)
    expect(listLoans(db)).toEqual([])
    expect(balance(debit)).toBe(100000)
    expect(balance(cash)).toBe(0)
  })
})
