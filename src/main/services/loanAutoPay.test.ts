import type Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import type { BankLoanInput } from '@shared/loans'
import { createTestDb } from '../db/testing'
import { createAccount, setAccountArchived } from '../db/repositories/accounts'
import { createBankLoan, updateBankLoan } from '../db/repositories/bankLoans'
import { getLoan, listLoanInstallments } from '../db/repositories/loans'
import { postDueLoanInstallments } from './posting'
import { dueReminders, markNotified, reminderMessages, upcomingPayments } from './reminders'

const TODAY = '2026-10-27'

let db: Database.Database
let debit: number

/** 3,000.00 at 0% over 3 months, the 1st installment on 15 September. */
const input = (overrides: Partial<BankLoanInput> = {}): BankLoanInput => ({
  counterparty: 'Erste',
  title: 'Car loan',
  principal: 300000,
  interestRate: 0,
  installmentsCount: 3,
  startDate: '2026-08-20',
  firstPaymentDate: '2026-09-15',
  createDisbursementTx: false,
  accountId: debit,
  autoPay: true,
  note: null,
  ...overrides
})

const paidDates = (loanId: number): (string | null)[] =>
  listLoanInstallments(db, loanId).map((i) => i.paidDate)

beforeEach(() => {
  db = createTestDb()
  debit = createAccount(db, {
    type: 'debit',
    name: 'Visa Debit',
    openingBalance: 500000,
    openingDate: '2026-01-01',
    color: 'blue'
  }).id
})

describe('paying automatically', () => {
  it('is on by default', () => {
    const { autoPay, ...rest } = input()
    void autoPay
    expect(createBankLoan(db, rest).autoPay).toBe(true)
  })

  it('pays each installment on its due date, once', () => {
    const id = createBankLoan(db, input()).id
    expect(postDueLoanInstallments(db, TODAY)).toBe(2)
    expect(postDueLoanInstallments(db, TODAY)).toBe(0)
    expect(paidDates(id)).toEqual(['2026-09-15', '2026-10-15', null])
    expect(postDueLoanInstallments(db, '2026-11-15')).toBe(1)
    expect(getLoan(db, id).status).toBe('paid_off')
  })

  it('leaves loans paid by hand alone', () => {
    const id = createBankLoan(db, input({ autoPay: false })).id
    expect(postDueLoanInstallments(db, TODAY)).toBe(0)
    expect(getLoan(db, id).bank?.overdueCount).toBe(2)
    // Turning it on pays what's due.
    updateBankLoan(db, id, input({ autoPay: true }))
    expect(postDueLoanInstallments(db, TODAY)).toBe(2)
  })

  it('keeps paying from the loan’s account once it’s archived', () => {
    const id = createBankLoan(db, input()).id
    setAccountArchived(db, debit, true)
    expect(postDueLoanInstallments(db, TODAY)).toBe(2)
    expect(getLoan(db, id).bank?.overdueCount).toBe(0)
  })

  it('leaves an installment due before the account opened', () => {
    db.prepare('UPDATE accounts SET opening_date = ? WHERE id = ?').run('2026-10-01', debit)
    const id = createBankLoan(db, input()).id
    expect(postDueLoanInstallments(db, TODAY)).toBe(1)
    expect(paidDates(id)).toEqual([null, '2026-10-15', null])
  })
})

describe('reminders for loans paid by hand', () => {
  const later = (overrides: Partial<BankLoanInput> = {}): number =>
    createBankLoan(
      db,
      input({ startDate: '2026-10-01', firstPaymentDate: '2026-10-30', ...overrides })
    ).id

  it('come 3 days before each installment, once', () => {
    const id = later({ autoPay: false })
    expect(dueReminders(db, '2026-10-26')).toEqual([])
    const due = dueReminders(db, TODAY)
    expect(due.map((r) => [r.planned.title, r.planned.date, r.reminderDaysBefore])).toEqual([
      ['Car loan (1/3)', '2026-10-30', 3]
    ])
    markNotified(
      db,
      due.map((r) => r.planned)
    )
    expect(dueReminders(db, '2026-10-28')).toEqual([])
    expect(
      db
        .prepare('SELECT source_type FROM notification_log WHERE source_id = ?')
        .all(listLoanInstallments(db, id)[0].id)
    ).toEqual([{ source_type: 'loan_installment' }])
  })

  it('aren’t needed when the loan pays itself', () => {
    later()
    expect(dueReminders(db, TODAY)).toEqual([])
  })

  it('open the loan’s row on Month when clicked', () => {
    const id = later({ autoPay: false })
    const [message] = reminderMessages(
      dueReminders(db, TODAY),
      new Map([[debit, 'Visa Debit']]),
      { currency: 'EUR', locale: 'en-GB' },
      TODAY
    )
    expect(message).toEqual({
      title: 'Car loan (1/3) is due on Friday 30 Oct',
      body: '€1,000.00 · Visa Debit',
      path: `/?month=2026-10&row=loan%3A${id}`
    })
  })
})

describe('upcomingPayments', () => {
  it('lists overdue loan installments first', () => {
    createBankLoan(db, input({ autoPay: false }))
    expect(upcomingPayments(db, TODAY).map((u) => [u.planned.date, u.planned.overdue])).toEqual([
      ['2026-09-15', true],
      ['2026-10-15', true]
    ])
  })
})
