import type Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import type { BankLoanInput } from '@shared/loans'
import { calendarMonth, plannedItems, projectedBalance } from '../../services/planned'
import { createTestDb } from '../testing'
import { createAccount, getAccount } from './accounts'
import { createBankLoan, payInstallment, unpayInstallment, updateBankLoan } from './bankLoans'
import {
  addRepayment,
  deleteLoan,
  getLoan,
  listLoanInstallments,
  listLoanTransactions,
  settleLoan
} from './loans'

const TODAY = '2026-10-27'

let db: Database.Database
let debit: number

/** 10,000.00 at 6% over 12 months, paid on the 15th from November. */
const carLoan = (overrides: Partial<BankLoanInput> = {}): number =>
  createBankLoan(db, {
    counterparty: 'Erste',
    title: 'Car loan',
    principal: 1000000,
    interestRate: 6,
    installmentsCount: 12,
    startDate: '2026-10-20',
    firstPaymentDate: '2026-11-15',
    createDisbursementTx: true,
    accountId: debit,
    note: null,
    ...overrides
  }).id

const input = (overrides: Partial<BankLoanInput> = {}): BankLoanInput => ({
  counterparty: 'Erste',
  title: 'Car loan',
  principal: 1000000,
  interestRate: 6,
  installmentsCount: 12,
  startDate: '2026-10-20',
  firstPaymentDate: '2026-11-15',
  createDisbursementTx: true,
  accountId: debit,
  note: null,
  ...overrides
})

const pay = (installmentId: number, date = '2026-11-15'): void => {
  payInstallment(db, installmentId, { accountId: debit, date })
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
})

describe('createBankLoan', () => {
  it('generates the schedule and records the money arriving', () => {
    const id = carLoan()
    const schedule = listLoanInstallments(db, id)
    expect(schedule).toHaveLength(12)
    expect(schedule[0]).toMatchObject({
      seq: 1,
      dueDate: '2026-11-15',
      amount: 86066,
      principalPart: 81066,
      interestPart: 5000,
      balance: 918934,
      transactionId: null
    })
    expect(schedule.at(-1)).toMatchObject({ dueDate: '2027-10-15', balance: 0 })
    expect(getLoan(db, id)).toMatchObject({
      kind: 'bank_loan',
      title: 'Car loan',
      counterparty: 'Erste',
      interestRate: 6,
      installmentsCount: 12,
      paymentDay: 15,
      status: 'active',
      repaid: 0,
      outstanding: 1000000,
      bank: {
        monthlyPayment: 86066,
        paidCount: 0,
        interestPaid: 0,
        overdueCount: 0,
        payoffDate: '2027-10-15',
        next: { seq: 1, dueDate: '2026-11-15', amount: 86066 }
      }
    })
    expect(getAccount(db, debit, TODAY).balance).toBe(1100000)
  })

  it('defaults the title to the bank and can leave the money unrecorded', () => {
    const id = carLoan({ title: '', createDisbursementTx: false })
    expect(getLoan(db, id).title).toBe('Loan from Erste')
    expect(listLoanTransactions(db, id)).toEqual([])
  })

  it('needs the first installment after the start', () => {
    expect(() => carLoan({ firstPaymentDate: '2026-10-20' })).toThrow(/after the loan starts/)
  })
})

describe('installments', () => {
  it('are paid one by one, lowering the principal still owed', () => {
    const id = carLoan()
    const [first, second] = listLoanInstallments(db, id)
    pay(first.id)
    expect(getLoan(db, id)).toMatchObject({
      repaid: 81066,
      outstanding: 918934,
      bank: { paidCount: 1, interestPaid: 5000, next: { seq: 2 } }
    })
    expect(listLoanTransactions(db, id)[0]).toMatchObject({
      type: 'loan_out',
      title: 'Car loan 1/12',
      amount: 86066,
      loanInstallmentId: first.id,
      plannedDate: '2026-11-15'
    })
    expect(() => pay(first.id)).toThrow(/paid already/)

    unpayInstallment(db, first.id)
    expect(getLoan(db, id).outstanding).toBe(1000000)
    pay(second.id, '2026-12-14')
    expect(listLoanInstallments(db, id)[1]).toMatchObject({ paidDate: '2026-12-14' })
  })

  it('pay the loan off with the last one', () => {
    const id = carLoan({ installmentsCount: 2, principal: 100000 })
    for (const row of listLoanInstallments(db, id)) pay(row.id)
    expect(getLoan(db, id)).toMatchObject({
      status: 'paid_off',
      outstanding: 0,
      bank: { next: null }
    })
  })

  it('count as overdue once their date has passed', () => {
    const id = carLoan({ startDate: '2026-08-01', firstPaymentDate: '2026-09-15' })
    expect(getLoan(db, id).bank).toMatchObject({ overdueCount: 2 })
  })

  it('aren’t paid with free repayments or closed early', () => {
    const id = carLoan()
    expect(() =>
      addRepayment(db, { loanId: id, amount: 100, accountId: debit, date: TODAY, note: null })
    ).toThrow(/one installment at a time/)
    expect(() => settleLoan(db, id, { how: 'forgiven' })).toThrow(/one installment at a time/)
  })
})

describe('updateBankLoan', () => {
  it('regenerates the schedule while nothing is paid', () => {
    const id = carLoan()
    updateBankLoan(db, id, input({ installmentsCount: 24, interestRate: 4 }))
    expect(listLoanInstallments(db, id)).toHaveLength(24)
    expect(getLoan(db, id).bank?.payoffDate).toBe('2028-10-15')
  })

  it('keeps the terms once an installment is paid, but renames', () => {
    const id = carLoan()
    pay(listLoanInstallments(db, id)[0].id)
    expect(() => updateBankLoan(db, id, input({ principal: 2000000 }))).toThrow(/paid already/)
    updateBankLoan(db, id, input({ title: 'Golf', counterparty: 'Erste Bank' }))
    expect(getLoan(db, id)).toMatchObject({ title: 'Golf', counterparty: 'Erste Bank' })
  })
})

describe('in the calendar and the expected balance', () => {
  it('unpaid installments are planned loan payments', () => {
    const id = carLoan()
    pay(listLoanInstallments(db, id)[0].id)
    expect(
      plannedItems(db, '2026-11-01', '2027-01-31', TODAY).map((p) => [
        p.source,
        p.date,
        p.title,
        p.group,
        p.loanId
      ])
    ).toEqual([
      ['loan_installment', '2026-12-15', 'Car loan 2/12', 'loan', id],
      ['loan_installment', '2027-01-15', 'Car loan 3/12', 'loan', id]
    ])
    // 1,000 + 10,000 received − 860.66 paid − 860.66 due 15 December
    expect(projectedBalance(db, '2026-12-31', TODAY)).toBe(100000 + 1000000 - 2 * 86066)
    // Not spending in the calendar's totals, but in its ending balance.
    const december = calendarMonth(db, { month: '2026-12-01' }, TODAY).summary
    expect(december.plannedExpenses).toBe(0)
    expect(december.endingBalance).toBe(100000 + 1000000 - 2 * 86066)
  })

  it('leave the calendar with the loan', () => {
    const id = carLoan()
    deleteLoan(db, id)
    expect(plannedItems(db, '2026-11-01', '2027-12-31', TODAY)).toEqual([])
    expect(getAccount(db, debit, TODAY).balance).toBe(100000)
  })
})
