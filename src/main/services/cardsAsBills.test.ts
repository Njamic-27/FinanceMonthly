import type Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import type { MonthSheet, MonthSheetRow } from '@shared/month'
import { createTestDb } from '../db/testing'
import { createAccount } from '../db/repositories/accounts'
import { createBankLoan } from '../db/repositories/bankLoans'
import { listCategories } from '../db/repositories/categories'
import { createInstallmentPlan } from '../db/repositories/installments'
import { createRecurringItem } from '../db/repositories/recurring'
import { addSavingsMovement, createSavingsGoal } from '../db/repositories/savings'
import { createTransaction } from '../db/repositories/transactions'
import { cardBillsDue } from './cards'
import { monthSheet } from './monthSheet'
import { postDueInstallments, postDueItems } from './posting'

// A credit card is a bill paid from a debit account (PLAN.md §2, step 49): its purchases count
// only in the month the bill is paid, and money out is what leaves your accounts.

const TODAY = '2026-10-27'

let db: Database.Database
let debit: number
let cash: number
let card: number

const categoryId = (name: string): number => {
  const category = listCategories(db).find((c) => c.name === name)
  if (!category) throw new Error(`No category ${name}`)
  return category.id
}

const sheet = (month: string, today = TODAY): MonthSheet => monthSheet(db, { month }, today)
const rows = (s: MonthSheet): MonthSheetRow[] => s.sections.flatMap((x) => x.rows)
const section = (s: MonthSheet, key: string): MonthSheetRow[] =>
  s.sections.find((x) => x.key === key)?.rows ?? []
const cardLine = (s: MonthSheet): MonthSheet['byAccount'][number] | undefined =>
  s.byAccount.find((l) => l.group === 'card' && l.cardId === card)

beforeEach(() => {
  db = createTestDb()
  debit = createAccount(db, {
    type: 'debit',
    name: 'Visa Debit',
    openingBalance: 500000,
    openingDate: '2026-01-01',
    color: 'blue'
  }).id
  cash = createAccount(db, {
    type: 'cash',
    name: 'Wallet',
    openingBalance: 20000,
    openingDate: '2026-01-01',
    color: 'olive'
  }).id
  card = createAccount(db, {
    type: 'credit',
    name: 'Mastercard',
    openingBalance: 0,
    openingDate: '2026-01-01',
    color: 'orange',
    creditLimit: 300000,
    statementDay: 25,
    paymentDueDay: 15,
    payFromAccountId: debit
  }).id

  // A PlayStation bought on 10 October in 6 installments of €100 on the card.
  createInstallmentPlan(db, {
    accountId: card,
    title: 'PlayStation',
    categoryId: categoryId('Shopping'),
    totalAmount: 60000,
    count: 6,
    firstDate: '2026-10-10',
    note: null
  })
  postDueInstallments(db, TODAY)
  // Netflix on the card, charged on the 5th.
  createRecurringItem(db, {
    kind: 'subscription',
    title: 'Netflix',
    amount: 1399,
    accountId: card,
    categoryId: categoryId('Subscriptions'),
    frequency: 'monthly',
    interval: 1,
    anchorDate: '2026-10-05',
    nextDueDate: '2026-10-05',
    autoPost: true,
    reminderDaysBefore: null
  })
  postDueItems(db, TODAY)
})

describe('card purchases', () => {
  it('show nothing in the month they were bought', () => {
    const october = sheet('2026-10')
    expect(rows(october).filter((r) => r.title === 'PlayStation' || r.title === 'Netflix')).toEqual(
      []
    )
    expect(cardLine(october)).toBeUndefined()
  })

  it('count in the month the bill is paid, in their group, marked with their card', () => {
    const november = sheet('2026-11')
    expect(section(november, 'everyday')).toContainEqual(
      expect.objectContaining({
        kind: 'installment_plan',
        title: 'PlayStation',
        actual: 10000,
        byCard: [{ accountId: card, amount: 10000 }]
      })
    )
    expect(section(november, 'subscriptions')).toContainEqual(
      expect.objectContaining({ kind: 'recurring', title: 'Netflix', actual: 1399 })
    )
    // Under the debit account that pays the bill, as one line.
    expect(cardLine(november)).toMatchObject({
      accountId: debit,
      recorded: 10000 + 1399,
      count: 2
    })
    // December: the second installment and November's Netflix, still planned.
    expect(cardLine(sheet('2026-12'))).toMatchObject({ planned: 10000 + 1399 })
  })

  it('keep the card itself as an informational bill row, not counted', () => {
    const november = sheet('2026-11')
    expect(section(november, 'cards')).toEqual([
      expect.objectContaining({ kind: 'card_payment', sourceId: card, onBill: 10000 + 1399 })
    ])
    expect(november.totals.spending).toBe(10000 + 1399)
  })
})

describe('money out', () => {
  beforeEach(() => {
    const buy = (date: string, amount: number, accountId: number, category = 'Groceries'): void => {
      createTransaction(db, {
        type: 'expense',
        title: '',
        amount,
        date,
        accountId,
        categoryId: categoryId(category),
        note: null
      })
    }
    buy('2026-11-03', 2500, debit)
    buy('2026-11-04', 1200, cash)
    buy('2026-11-06', 3000, debit, 'Rent')
    // Paying the card's bill moves money; its purchases are already counted.
    createTransaction(db, {
      type: 'transfer',
      title: '',
      amount: 11399,
      date: '2026-11-15',
      accountId: debit,
      toAccountId: card,
      note: null
    })
    createBankLoan(db, {
      counterparty: 'Erste',
      title: 'Car loan',
      principal: 90000,
      interestRate: 0,
      installmentsCount: 3,
      startDate: '2026-10-20',
      firstPaymentDate: '2026-11-20',
      createDisbursementTx: false,
      accountId: debit,
      autoPay: false,
      note: null
    })
    const goal = createSavingsGoal(db, {
      name: 'Holiday',
      targetAmount: 100000,
      targetDate: null,
      startingAmount: 0,
      plannedMonthly: 5000,
      color: 'blue'
    }).id
    addSavingsMovement(db, {
      goalId: goal,
      type: 'deposit',
      amount: 4000,
      accountId: debit,
      date: '2026-11-02',
      note: null
    })
  })

  it('is spending, loans and savings, by account and by group alike', () => {
    for (const month of ['2026-10', '2026-11', '2026-12', '2027-01']) {
      const s = sheet(month)
      const byAccount = s.byAccount.reduce((sum, l) => sum + l.recorded + l.planned, 0)
      expect(byAccount).toBe(s.totals.moneyOut)
      expect(s.totals.moneyOut).toBe(s.totals.spending + s.totals.loans + s.totals.savings)
    }
    const november = sheet('2026-11')
    expect(november.totals).toMatchObject({
      spending: 10000 + 1399 + 2500 + 1200 + 3000,
      loans: 30000,
      savings: 4000,
      moneyOut: 10000 + 1399 + 2500 + 1200 + 3000 + 30000 + 4000
    })
    expect(november.totals.net).toBe(november.totals.moneyIn - november.totals.moneyOut)
    const line = (accountId: number, group: string): number | undefined => {
      const l = november.byAccount.find((x) => x.accountId === accountId && x.group === group)
      return l && l.recorded + l.planned
    }
    expect(line(debit, 'everyday')).toBe(2500)
    expect(line(debit, 'bills')).toBe(3000)
    expect(line(cash, 'everyday')).toBe(1200)
    expect(line(debit, 'loans')).toBe(30000)
    expect(line(debit, 'savings')).toBe(4000)
    expect(line(debit, 'card')).toBe(10000 + 1399)
  })
})

describe('card bills due', () => {
  it('wait on Month until they’re paid', () => {
    // The statement of 25 October holds the PlayStation's first installment and Netflix.
    expect(cardBillsDue(db, '2026-11-10')).toEqual([
      {
        accountId: card,
        name: 'Mastercard',
        dueDate: '2026-11-15',
        amount: 10000 + 1399,
        payFromAccountId: debit
      }
    ])
    // Not yet within a week of the due date.
    expect(cardBillsDue(db, '2026-11-01')).toEqual([])
    createTransaction(db, {
      type: 'transfer',
      title: '',
      amount: 11399,
      date: '2026-11-10',
      accountId: debit,
      toAccountId: card,
      note: null
    })
    expect(cardBillsDue(db, '2026-11-10')).toEqual([])
  })
})
