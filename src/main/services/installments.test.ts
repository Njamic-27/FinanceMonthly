import type Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import type { InstallmentPlanInput } from '@shared/installments'
import { createTestDb } from '../db/testing'
import { createAccount, getAccount, setAccountArchived } from '../db/repositories/accounts'
import { listCategories } from '../db/repositories/categories'
import {
  createInstallmentPlan,
  deleteInstallmentPlan,
  getInstallmentPlan,
  listInstallmentPlans
} from '../db/repositories/installments'
import { createRecurringItem } from '../db/repositories/recurring'
import { deleteTransaction, listTransactions } from '../db/repositories/transactions'
import { cardStatus } from './cards'
import { plannedItems, projectedBalance } from './planned'
import { postDueInstallments } from './posting'
import { upcomingPayments } from './reminders'

const TODAY = '2026-10-27'

let db: Database.Database
let debit: number
let card: number

const categoryId = (name: string): number =>
  listCategories(db).find((c) => c.name === name)?.id ?? 0

/** 2,000.00 for a laptop in 5 installments from today. */
const laptop = (overrides: Partial<InstallmentPlanInput> = {}): number =>
  createInstallmentPlan(db, {
    accountId: card,
    title: 'Laptop',
    categoryId: categoryId('Shopping'),
    totalAmount: 200000,
    count: 5,
    firstDate: TODAY,
    note: null,
    ...overrides
  }).id

const charged = (): [string, string, number][] =>
  listTransactions(db, { accountId: card })
    .items.map((t): [string, string, number] => [t.date, t.title, t.amount])
    .reverse()

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
    color: 'orange',
    creditLimit: 300000,
    statementDay: 25,
    paymentDueDay: 15
  }).id
})

describe('createInstallmentPlan', () => {
  it('records the plan without charging anything itself', () => {
    const plan = getInstallmentPlan(db, laptop({ totalAmount: 100000, count: 3 }))
    expect(plan).toMatchObject({
      title: 'Laptop',
      totalAmount: 100000,
      count: 3,
      installment: 33333,
      lastInstallment: 33334,
      postedCount: 0,
      remaining: 100000,
      nextDate: TODAY,
      lastDate: '2026-12-27'
    })
    expect(charged()).toEqual([])
  })

  it('takes the category name when the title is empty', () => {
    expect(getInstallmentPlan(db, laptop({ title: ' ' })).title).toBe('Shopping')
  })

  it('only takes purchases on an open credit card in an expense category', () => {
    expect(() => laptop({ accountId: debit })).toThrow(/credit card/)
    expect(() => laptop({ categoryId: categoryId('Salary') })).toThrow(/expense category/)
    expect(() => laptop({ firstDate: '2025-12-31' })).toThrow(/starts on/)
    setAccountArchived(db, card, true)
    expect(() => laptop()).toThrow(/archived/)
  })
})

describe('postDueInstallments', () => {
  it('charges each installment on its date, once', () => {
    laptop({ totalAmount: 100000, count: 3, firstDate: '2026-08-31' })
    expect(postDueInstallments(db, TODAY)).toBe(2)
    expect(postDueInstallments(db, TODAY)).toBe(0)
    expect(charged()).toEqual([
      ['2026-08-31', 'Laptop (1/3)', 33333],
      ['2026-09-30', 'Laptop (2/3)', 33333]
    ])
    expect(postDueInstallments(db, '2026-10-31')).toBe(1)
    expect(charged().at(-1)).toEqual(['2026-10-31', 'Laptop (3/3)', 33334])
    expect(listTransactions(db, { accountId: card }).items[0]).toMatchObject({
      type: 'expense',
      categoryId: categoryId('Shopping'),
      installmentPlanId: expect.any(Number),
      plannedDate: '2026-10-31'
    })
  })

  it('keeps charging a card that was archived after the purchase', () => {
    laptop({ firstDate: '2026-09-27' })
    setAccountArchived(db, card, true)
    expect(postDueInstallments(db, TODAY)).toBe(2)
  })
})

describe('card limit', () => {
  it('reserves what is still to be charged', () => {
    const id = laptop()
    postDueInstallments(db, TODAY)
    expect(getInstallmentPlan(db, id)).toMatchObject({ postedCount: 1, remaining: 160000 })
    // 3,000 limit − 400 charged − 1,600 still to come
    expect(getAccount(db, card)).toMatchObject({
      balance: -40000,
      reserved: 160000,
      available: 100000
    })
    expect(cardStatus(db, card, TODAY)).toMatchObject({
      owed: 40000,
      reserved: 160000,
      available: 100000
    })
  })

  it('gives the limit back as installments are charged, down to nothing', () => {
    laptop({ totalAmount: 100000, count: 3, firstDate: '2026-08-31' })
    postDueInstallments(db, '2026-10-31')
    expect(getAccount(db, card, '2026-10-31')).toMatchObject({ reserved: 0, available: 200000 })
  })

  it('reserves nothing on other accounts', () => {
    expect(getAccount(db, debit).reserved).toBeNull()
  })
})

describe('planned installments', () => {
  it('appear as planned expenses until charged, with no reminder', () => {
    laptop()
    postDueInstallments(db, TODAY)
    expect(
      plannedItems(db, TODAY, '2027-03-31', TODAY).map((p) => [p.source, p.date, p.title, p.amount])
    ).toEqual([
      ['installment_plan', '2026-11-27', 'Laptop (2/5)', 40000],
      ['installment_plan', '2026-12-27', 'Laptop (3/5)', 40000],
      ['installment_plan', '2027-01-27', 'Laptop (4/5)', 40000],
      ['installment_plan', '2027-02-27', 'Laptop (5/5)', 40000]
    ])
    // A recurring item with the same id doesn't lend its reminder to an installment.
    createRecurringItem(db, {
      kind: 'subscription',
      title: 'Netflix',
      amount: 1399,
      accountId: card,
      categoryId: categoryId('Subscriptions'),
      frequency: 'monthly',
      interval: 1,
      anchorDate: '2026-11-30',
      nextDueDate: '2026-11-30',
      autoPost: false,
      reminderDaysBefore: 2
    })
    expect(
      upcomingPayments(db, '2026-11-20').map((u) => [u.planned.title, u.reminderDaysBefore])
    ).toEqual([
      ['Laptop (2/5)', null],
      ['Netflix', 2]
    ])
  })

  it('count toward the expected balance', () => {
    laptop()
    postDueInstallments(db, TODAY)
    // 1,000 on the debit card − 400 charged − 400 more by 30 November
    expect(projectedBalance(db, '2026-11-30', TODAY)).toBe(100000 - 40000 - 40000)
  })
})

describe('deleting', () => {
  it('refuses a single installment', () => {
    laptop()
    postDueInstallments(db, TODAY)
    const [installment] = listTransactions(db, { accountId: card }).items
    expect(() => deleteTransaction(db, installment.id)).toThrow(/whole purchase/)
  })

  it('deletes the purchase with every installment charged', () => {
    const id = laptop({ firstDate: '2026-08-27' })
    postDueInstallments(db, TODAY)
    deleteInstallmentPlan(db, id)
    expect(listInstallmentPlans(db)).toEqual([])
    expect(charged()).toEqual([])
    expect(getAccount(db, card)).toMatchObject({ balance: 0, reserved: 0, available: 300000 })
  })
})
