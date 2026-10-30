import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { installmentsTitle, installmentTitle } from '@shared/installments'
import { postDueInstallments } from '../services/posting'
import { registerFunctions } from './functions'
import { migrate } from './migrate'
import { migrations } from './migrations'
import { createAccount } from './repositories/accounts'
import { createBankLoan, payInstallment } from './repositories/bankLoans'
import { createInstallmentPlan } from './repositories/installments'
import { listLoanInstallments } from './repositories/loans'
import { createTransaction } from './repositories/transactions'

// Installment numbers (PLAN.md step 52): one helper, and migration 008 dropping the brackets.

describe('installment titles', () => {
  it('number an installment, or the ones in a month', () => {
    expect(installmentTitle('PlayStation', 1, 6)).toBe('PlayStation 1/6')
    expect(installmentsTitle('PlayStation', [2], 6)).toBe('PlayStation 2/6')
    expect(installmentsTitle('PlayStation', [3, 2], 6)).toBe('PlayStation 2–3/6')
    expect(installmentsTitle('PlayStation', [], 6)).toBe('PlayStation')
  })
})

describe('migration 008', () => {
  it('rewrites "X (n/N)" on installments and loan payments, and nothing else', () => {
    const db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    registerFunctions(db)
    migrate(db, migrations.slice(0, 7))
    const debit = createAccount(db, {
      type: 'debit',
      name: 'Visa Debit',
      openingBalance: 100000,
      openingDate: '2026-01-01',
      color: 'blue'
    }).id
    const card = createAccount(db, {
      type: 'credit',
      name: 'Mastercard',
      openingBalance: 0,
      openingDate: '2026-01-01',
      color: 'orange',
      creditLimit: 500000,
      statementDay: 25,
      paymentDueDay: 15
    }).id
    const category = (
      db.prepare("SELECT id FROM categories WHERE name = 'Shopping'").get() as { id: number }
    ).id
    const plan = (title: string): void => {
      createInstallmentPlan(db, {
        accountId: card,
        title,
        categoryId: category,
        totalAmount: 30000,
        count: 3,
        firstDate: '2026-09-10',
        note: null
      })
    }
    plan('Laptop')
    plan('Desk (oak)')
    postDueInstallments(db, '2026-10-20')
    const loan = createBankLoan(db, {
      counterparty: 'Erste',
      title: 'Car loan',
      principal: 120000,
      interestRate: 0,
      installmentsCount: 12,
      startDate: '2026-08-01',
      firstPaymentDate: '2026-09-01',
      createDisbursementTx: false,
      accountId: debit,
      autoPay: false,
      note: null
    })
    const [first] = listLoanInstallments(db, loan.id)
    payInstallment(db, first.id, { accountId: debit, date: '2026-09-01' })
    createTransaction(db, {
      type: 'expense',
      title: 'Dinner (1/2)',
      amount: 2000,
      date: '2026-10-01',
      accountId: debit,
      categoryId: category,
      note: null
    })
    // As versions before step 52 titled them, one renamed by hand.
    const titles = (): string[] =>
      (db.prepare('SELECT title FROM transactions ORDER BY id').all() as { title: string }[]).map(
        (t) => t.title
      )
    const old = [
      'Laptop (1/3)',
      'Laptop (2/3)',
      'Desk (oak) (1/3)',
      'My desk',
      'Car loan (1/12)',
      'Dinner (1/2)'
    ]
    const ids = (
      db.prepare('SELECT id FROM transactions ORDER BY id').all() as { id: number }[]
    ).map((t) => t.id)
    expect(ids).toHaveLength(old.length)
    ids.forEach((id, i) => {
      db.prepare('UPDATE transactions SET title = ? WHERE id = ?').run(old[i], id)
    })

    migrate(db, migrations)
    expect(titles()).toEqual([
      'Laptop 1/3',
      'Laptop 2/3',
      'Desk (oak) 1/3',
      'My desk',
      'Car loan 1/12',
      'Dinner (1/2)'
    ])
  })
})
