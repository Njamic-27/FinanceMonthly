import type Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import type { RecurringItemInput } from '@shared/recurring'
import { createTestDb } from '../db/testing'
import { createAccount } from '../db/repositories/accounts'
import { createBankLoan } from '../db/repositories/bankLoans'
import { listCategories } from '../db/repositories/categories'
import { createInstallmentPlan } from '../db/repositories/installments'
import { createRecurringItem } from '../db/repositories/recurring'
import { addSavingsMovement, createSavingsGoal } from '../db/repositories/savings'
import { updateSettings } from '../db/repositories/settings'
import { getAverageVariableSpending } from '../db/repositories/stats'
import { createTransaction } from '../db/repositories/transactions'
import { calendarMonth } from './planned'
import { postDueItems, setItemActive } from './posting'
import { buildProjection } from './projection'

const TODAY = '2026-10-27'

let db: Database.Database
let debit: number
let card: number

const categoryId = (name: string): number =>
  listCategories(db).find((c) => c.name === name)?.id ?? 0

const recurring = (overrides: Partial<RecurringItemInput>): number =>
  createRecurringItem(db, {
    kind: 'expense',
    title: 'Rent',
    amount: 65000,
    accountId: debit,
    categoryId: categoryId('Rent'),
    frequency: 'monthly',
    interval: 1,
    anchorDate: '2026-11-01',
    nextDueDate: '2026-11-01',
    autoPost: true,
    reminderDaysBefore: null,
    ...overrides
  }).id

const spend = (date: string, amount: number, extra: { categoryName?: string } = {}): void => {
  createTransaction(db, {
    type: 'expense',
    title: 'Shopping',
    amount,
    date,
    accountId: debit,
    categoryId: categoryId(extra.categoryName ?? 'Groceries'),
    note: null
  })
}

/** Only what's planned: no average spending, no savings plans. */
const plannedOnly = (): void => {
  updateSettings(db, { projectionIncludeVariable: false, projectionIncludeSavings: false })
}

beforeEach(() => {
  db = createTestDb()
  debit = createAccount(db, {
    type: 'debit',
    name: 'Visa Debit',
    openingBalance: 500000,
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

describe('buildProjection', () => {
  it('agrees with the calendar’s expected balance at each month end', () => {
    plannedOnly()
    recurring({
      kind: 'income',
      title: 'Salary',
      amount: 245000,
      categoryId: categoryId('Salary'),
      anchorDate: '2026-11-10',
      nextDueDate: '2026-11-10'
    })
    // Asks first and overdue: still to happen.
    recurring({ autoPost: false, anchorDate: '2026-10-01', nextDueDate: '2026-10-01' })
    recurring({
      kind: 'subscription',
      title: 'Netflix',
      amount: 1399,
      accountId: card,
      categoryId: categoryId('Subscriptions'),
      anchorDate: '2026-11-05',
      nextDueDate: '2026-11-05',
      autoPost: false
    })
    createInstallmentPlan(db, {
      accountId: card,
      title: 'Laptop',
      categoryId: categoryId('Shopping'),
      totalAmount: 90000,
      count: 3,
      firstDate: '2026-11-20',
      note: null
    })
    createBankLoan(db, {
      counterparty: 'Erste',
      title: 'Car loan',
      principal: 300000,
      interestRate: 6,
      installmentsCount: 3,
      startDate: '2026-10-20',
      firstPaymentDate: '2026-11-15',
      createDisbursementTx: false,
      accountId: debit,
      note: null
    })
    spend('2026-11-03', 4000) // entered for later

    const projection = buildProjection(db, { months: 3, granularity: 'month' }, TODAY)
    for (const period of projection.periods.slice(0, -1)) {
      expect(period.balance).toBe(
        calendarMonth(db, { month: period.end }, TODAY).summary.endingBalance
      )
    }
    expect(projection.periods[1]).toMatchObject({
      start: '2026-11-01',
      inflow: 245000,
      // rent ×1 (November), Netflix, laptop rate, entered shopping
      fixed: 65000 + 1399 + 30000 + 4000,
      loans: expect.any(Number)
    })
    // The overdue October rent counts today.
    expect(projection.periods[0].fixed).toBe(65000)
  })

  it('leaves paused subscriptions out', () => {
    plannedOnly()
    const gym = recurring({ title: 'Gym', amount: 3000 })
    setItemActive(db, gym, false, TODAY)
    const projection = buildProjection(db, { months: 6, granularity: 'month' }, TODAY)
    expect(projection.periods.every((p) => p.fixed === 0)).toBe(true)
    expect(projection.endBalance).toBe(500000)
  })

  it('stops a bank loan when it ends and marks the payoff', () => {
    plannedOnly()
    const loan = createBankLoan(db, {
      counterparty: 'Erste',
      title: 'Car loan',
      principal: 300000,
      interestRate: 0,
      installmentsCount: 3,
      startDate: '2026-10-20',
      firstPaymentDate: '2026-11-15',
      createDisbursementTx: false,
      accountId: debit,
      note: null
    })
    const projection = buildProjection(db, { months: 6, granularity: 'month' }, TODAY)
    expect(projection.periods.map((p) => p.loans)).toEqual([0, 100000, 100000, 100000, 0, 0, 0])
    expect(projection.milestones).toContainEqual({
      kind: 'loan_paid_off',
      sourceId: loan.id,
      title: 'Car loan',
      date: '2027-01-15'
    })
  })

  it('marks card purchases paid off', () => {
    plannedOnly()
    const plan = createInstallmentPlan(db, {
      accountId: card,
      title: 'Laptop',
      categoryId: categoryId('Shopping'),
      totalAmount: 90000,
      count: 3,
      firstDate: '2026-11-20',
      note: null
    })
    expect(buildProjection(db, { months: 3, granularity: 'month' }, TODAY).milestones).toEqual([
      { kind: 'plan_paid_off', sourceId: plan.id, title: 'Laptop', date: '2027-01-20' }
    ])
  })

  it('adds average everyday spending when Settings say so', () => {
    updateSettings(db, { projectionVariableMonths: 3, projectionIncludeSavings: false })
    // The 3 full months before this one: July to September.
    spend('2026-06-10', 77777)
    spend('2026-07-10', 90000)
    spend('2026-08-10', 30000)
    spend('2026-09-10', 60000)
    spend('2026-10-05', 99999) // this month: not a full month yet
    const projection = buildProjection(db, { months: 3, granularity: 'month' }, TODAY)
    expect(projection.assumptions).toMatchObject({
      includeVariable: true,
      variableMonths: 3,
      variableMonthly: 60000
    })
    // November: 30 days of 600.00 / 30.4375.
    expect(projection.periods[1].variable).toBeCloseTo((60000 * 30) / 30.4375, -1)

    updateSettings(db, { projectionIncludeVariable: false })
    const without = buildProjection(db, { months: 3, granularity: 'month' }, TODAY)
    expect(without.periods.every((p) => p.variable === 0)).toBe(true)
    expect(without.assumptions.variableMonthly).toBe(60000)
  })

  it('follows savings plans when Settings say so', () => {
    updateSettings(db, { projectionIncludeVariable: false })
    const goal = createSavingsGoal(db, {
      name: 'Holiday',
      targetAmount: 50000,
      targetDate: null,
      startingAmount: 0,
      plannedMonthly: 20000,
      color: 'sky'
    }).id
    addSavingsMovement(db, {
      goalId: goal,
      type: 'deposit',
      amount: 20000,
      accountId: debit,
      date: '2026-10-05',
      note: null
    })
    const projection = buildProjection(db, { months: 3, granularity: 'month' }, TODAY)
    expect(projection.periods.map((p) => p.savings)).toEqual([0, 20000, 10000, 0])
    expect(projection.milestones).toContainEqual({
      kind: 'goal_reached',
      sourceId: goal,
      title: 'Holiday',
      date: '2026-12-01'
    })

    updateSettings(db, { projectionIncludeSavings: false })
    expect(
      buildProjection(db, { months: 3, granularity: 'month' }, TODAY).periods.every(
        (p) => p.savings === 0
      )
    ).toBe(true)
  })
})

describe('getAverageVariableSpending', () => {
  it('leaves out recurring payments and installments', () => {
    recurring({ anchorDate: '2026-09-01', nextDueDate: '2026-09-01' })
    postDueItems(db, TODAY) // rent on 1 September and 1 October, posted from the item
    spend('2026-09-12', 12000)
    // July to September, the account having opened in January.
    expect(getAverageVariableSpending(db, 3, TODAY)).toBe(4000)
  })

  it('counts only months since the first data, and needs one full month', () => {
    const fresh = createTestDb()
    createAccount(fresh, {
      type: 'cash',
      name: 'Wallet',
      openingBalance: 0,
      openingDate: '2026-09-15',
      color: 'olive'
    })
    expect(getAverageVariableSpending(fresh, 6, TODAY)).toBe(0)
    expect(getAverageVariableSpending(fresh, 6, '2026-09-30')).toBeNull()
  })
})
