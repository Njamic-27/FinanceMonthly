import type Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  summaryDate,
  type MonthCellInput,
  type MonthSheet,
  type MonthSheetRow
} from '@shared/month'
import type { RecurringItemInput } from '@shared/recurring'
import { createTestDb } from '../db/testing'
import { createAccount } from '../db/repositories/accounts'
import { createBankLoan } from '../db/repositories/bankLoans'
import { listCategories, mergeCategory } from '../db/repositories/categories'
import { createInstallmentPlan } from '../db/repositories/installments'
import { listLoanInstallments } from '../db/repositories/loans'
import { addMonthRow } from '../db/repositories/monthRows'
import { createRecurringItem } from '../db/repositories/recurring'
import { addSavingsMovement, createSavingsGoal } from '../db/repositories/savings'
import { updateSettings } from '../db/repositories/settings'
import { getTotals } from '../db/repositories/stats'
import {
  createTransaction,
  getTransaction,
  listTransactions,
  updateTransaction
} from '../db/repositories/transactions'
import { copyFromLastMonth, monthSheet, setMonthCell } from './monthSheet'
import { calendarMonth } from './planned'
import { postDueInstallments, postDueItems } from './posting'
import { buildProjection } from './projection'

// Tuesday 27 October 2026.
const TODAY = '2026-10-27'

let db: Database.Database
let debit: number
let cash: number
let card: number

const categoryId = (name: string): number =>
  listCategories(db).find((c) => c.name === name)?.id ?? 0

const sheet = (month = '2026-10'): MonthSheet => monthSheet(db, { month }, TODAY)

const rows = (s: MonthSheet): MonthSheetRow[] => s.sections.flatMap((section) => section.rows)

const row = (kind: MonthSheetRow['kind'], sourceId: number, month = '2026-10'): MonthSheetRow =>
  rows(sheet(month)).find((r) => r.kind === kind && r.sourceId === sourceId) as MonthSheetRow

const section = (key: string, month = '2026-10'): MonthSheet['sections'][number] =>
  sheet(month).sections.find((s) => s.key === key) as MonthSheet['sections'][number]

const set = (input: Omit<MonthCellInput, 'month'> & { month?: string }): void =>
  setMonthCell(db, { month: '2026-10', ...input }, TODAY)

const buy = (
  date: string,
  amount: number,
  category = 'Groceries',
  accountId = debit,
  type: 'income' | 'expense' = 'expense'
): number =>
  createTransaction(db, {
    type,
    title: '',
    amount,
    date,
    accountId,
    categoryId: categoryId(category),
    note: null
  }).id

const recurring = (overrides: Partial<RecurringItemInput> = {}): number =>
  createRecurringItem(db, {
    kind: 'expense',
    title: 'Rent',
    amount: 65000,
    accountId: debit,
    categoryId: categoryId('Rent'),
    frequency: 'monthly',
    interval: 1,
    anchorDate: '2026-08-31',
    nextDueDate: '2026-10-31',
    autoPost: false,
    reminderDaysBefore: null,
    ...overrides
  }).id

const summaries = (): { date: string; amount: number; account_id: number }[] =>
  db
    .prepare(
      'SELECT date, amount, account_id FROM transactions WHERE is_month_total = 1 ORDER BY date, id'
    )
    .all() as { date: string; amount: number; account_id: number }[]

beforeEach(() => {
  db = createTestDb()
  const account = (name: string, type: 'debit' | 'cash'): number =>
    createAccount(db, {
      type,
      name,
      openingBalance: 500000,
      openingDate: '2026-01-01',
      color: 'blue'
    }).id
  debit = account('Visa Debit', 'debit')
  cash = account('Wallet', 'cash')
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

describe('summary dates', () => {
  it('are today in the current month and the last day otherwise', () => {
    expect(summaryDate('2026-10', TODAY)).toBe(TODAY)
    expect(summaryDate('2026-09', TODAY)).toBe('2026-09-30')
    expect(summaryDate('2026-11', TODAY)).toBe('2026-11-30')
    expect(summaryDate('2027-02', TODAY)).toBe('2027-02-28')
  })

  it('date the summary transactions', () => {
    const groceries = categoryId('Groceries')
    set({ kind: 'category', sourceId: groceries, amount: 10000 })
    set({ month: '2026-09', kind: 'category', sourceId: groceries, amount: 20000 })
    set({ month: '2026-11', kind: 'category', sourceId: groceries, amount: 30000 })
    expect(summaries().map((s) => s.date)).toEqual(['2026-09-30', TODAY, '2026-11-30'])
  })
})

describe('typing a category’s amount', () => {
  let groceries: number

  beforeEach(() => {
    groceries = categoryId('Groceries')
    buy('2026-10-03', 5000)
    buy('2026-10-10', 7000)
  })

  it('tops up the individual transactions with one summary', () => {
    set({ kind: 'category', sourceId: groceries, amount: 40000 })
    expect(row('category', groceries)).toMatchObject({ actual: 40000, summary: 28000, count: 3 })
    // Typing again changes the same summary.
    set({ kind: 'category', sourceId: groceries, amount: 30000 })
    expect(summaries()).toEqual([{ date: TODAY, amount: 18000, account_id: debit }])
    expect(row('category', groceries)).toMatchObject({ actual: 30000, summary: 18000, count: 3 })
  })

  it('refuses less than the individual transactions', () => {
    expect(() => set({ kind: 'category', sourceId: groceries, amount: 11999 })).toThrow(
      /already has .*120[.,]00/
    )
    expect(summaries()).toEqual([])
  })

  it('removes the summary with 0, or with just the individual transactions', () => {
    set({ kind: 'category', sourceId: groceries, amount: 40000 })
    set({ kind: 'category', sourceId: groceries, amount: 0 })
    expect(summaries()).toEqual([])
    expect(row('category', groceries)).toMatchObject({ actual: 12000, summary: 0, count: 2 })

    set({ kind: 'category', sourceId: groceries, amount: 40000 })
    set({ kind: 'category', sourceId: groceries, amount: 12000 })
    expect(summaries()).toEqual([])
  })

  it('uses the row’s account, or the one asked for', () => {
    const eatingOut = categoryId('Eating out')
    addMonthRow(db, { categoryId: eatingOut, accountId: cash })
    expect(row('category', eatingOut)).toMatchObject({ actual: 0, accountId: cash })
    set({ kind: 'category', sourceId: eatingOut, amount: 8000 })
    set({ month: '2026-09', kind: 'category', sourceId: eatingOut, amount: 8000, accountId: debit })
    expect(summaries().map((s) => s.account_id)).toEqual([debit, cash])
  })

  it('works for income too', () => {
    const bonus = categoryId('Bonus')
    set({ kind: 'category', sourceId: bonus, amount: 50000 })
    expect(section('income').actual).toBe(50000)
    expect(getTotals(db, { from: '2026-10-01', to: '2026-10-31' }).income).toBe(50000)
  })

  it('leaves an edited summary moved to another month as an ordinary transaction', () => {
    set({ kind: 'category', sourceId: groceries, amount: 40000 })
    const [summary] = listTransactions(db).items.filter((t) => t.isMonthTotal)
    set({ month: '2026-11', kind: 'category', sourceId: groceries, amount: 10000 })
    updateTransaction(db, summary.id, {
      type: 'expense',
      title: summary.title,
      amount: summary.amount,
      date: '2026-11-02',
      accountId: debit,
      categoryId: groceries,
      note: null
    })
    expect(getTransaction(db, summary.id).isMonthTotal).toBe(false)
    expect(row('category', groceries, '2026-11')).toMatchObject({
      actual: 38000,
      summary: 10000,
      count: 2
    })
  })

  it('combines summaries when categories are merged', () => {
    const shopping = categoryId('Shopping')
    set({ kind: 'category', sourceId: groceries, amount: 40000 })
    set({ kind: 'category', sourceId: shopping, amount: 5000 })
    addMonthRow(db, { categoryId: shopping, accountId: cash })
    mergeCategory(db, shopping, groceries)
    expect(summaries()).toEqual([{ date: TODAY, amount: 33000, account_id: debit }])
    expect(row('category', groceries)).toMatchObject({ actual: 45000, rowId: expect.any(Number) })
  })
})

describe('rows', () => {
  it('show added categories, and any other with transactions in the month', () => {
    addMonthRow(db, { categoryId: categoryId('Eating out'), accountId: debit })
    buy('2026-10-05', 3000, 'Health')
    buy('2026-09-05', 3000, 'Transport')
    expect(section('expenses').rows.map((r) => r.title)).toEqual(['Eating out', 'Health'])
  })

  it('count every transaction once: categories, recurring items, installments and loans', () => {
    // Rent posted by its recurring item, a laptop in installments, a bank loan installment,
    // and purchases of their own in the same categories.
    const rent = recurring({ autoPost: true, anchorDate: '2026-08-15', nextDueDate: '2026-10-15' })
    postDueItems(db, TODAY)
    buy('2026-10-12', 2000, 'Rent')
    const plan = createInstallmentPlan(db, {
      accountId: card,
      title: 'Laptop',
      categoryId: categoryId('Shopping'),
      totalAmount: 100000,
      count: 4,
      firstDate: '2026-09-20',
      note: null
    }).id
    postDueInstallments(db, TODAY)
    buy('2026-10-14', 4500, 'Shopping', card)
    const loan = createBankLoan(db, {
      counterparty: 'Erste',
      title: 'Car loan',
      principal: 300000,
      interestRate: 0,
      installmentsCount: 3,
      startDate: '2026-08-20',
      firstPaymentDate: '2026-09-15',
      createDisbursementTx: false,
      accountId: debit,
      autoPay: false,
      note: null
    }).id

    const october = sheet()
    const find = (kind: MonthSheetRow['kind'], id: number): MonthSheetRow | undefined =>
      rows(october).find((r) => r.kind === kind && r.sourceId === id)
    expect(find('recurring', rent)).toMatchObject({ actual: 65000, planned: 0, count: 1 })
    expect(find('category', categoryId('Rent'))).toMatchObject({ actual: 2000, count: 1 })
    expect(find('installment_plan', plan)).toMatchObject({ actual: 25000, editable: false })
    expect(find('category', categoryId('Shopping'))).toMatchObject({ actual: 4500, count: 1 })
    // The installment due 15 October isn't paid: planned, overdue, and out of the balance.
    expect(find('loan', loan)).toMatchObject({ actual: 0, planned: -100000, overdue: true })

    const expenses = october.sections
      .filter((s) => s.key !== 'loans' && s.key !== 'savings' && s.key !== 'income')
      .flatMap((s) => s.rows)
      .filter((r) => r.kind !== 'card_payment')
    expect(expenses.reduce((sum, r) => sum + r.actual, 0)).toBe(65000 + 2000 + 25000 + 4500)
  })

  it('add up to the Calendar’s and Overview’s totals', () => {
    recurring() // Rent, asking first, due 31 October
    createRecurringItem(db, {
      kind: 'income',
      title: 'Salary',
      amount: 245000,
      accountId: debit,
      categoryId: categoryId('Salary'),
      frequency: 'monthly',
      interval: 1,
      anchorDate: '2026-09-10',
      nextDueDate: '2026-09-10',
      autoPost: true,
      reminderDaysBefore: null
    })
    createRecurringItem(db, {
      kind: 'subscription',
      title: 'Netflix',
      amount: 1399,
      accountId: card,
      categoryId: categoryId('Subscriptions'),
      frequency: 'monthly',
      interval: 1,
      anchorDate: '2026-10-29',
      nextDueDate: '2026-10-29',
      autoPost: true,
      reminderDaysBefore: null
    })
    postDueItems(db, TODAY)
    buy('2026-10-03', 5000)
    buy('2026-10-21', 3000, 'Eating out', card)
    buy('2026-10-22', 12000, 'Other income', debit, 'income')
    set({ kind: 'category', sourceId: categoryId('Groceries'), amount: 30000 })
    createTransaction(db, {
      type: 'transfer',
      title: '',
      amount: 10000,
      date: '2026-10-15',
      accountId: debit,
      toAccountId: card,
      note: null
    })

    for (const month of ['2026-09', '2026-10', '2026-11']) {
      const s = sheet(month)
      const range = { from: s.range.start, to: s.range.end }
      const totals = getTotals(db, range)
      const calendar = calendarMonth(db, { month: s.range.start }, TODAY).summary
      const spending = s.sections
        .filter((x) => ['expenses', 'subscriptions', 'cards'].includes(x.key))
        .flatMap((x) => x.rows)
        .filter((r) => r.kind !== 'card_payment')
      const income = s.sections.find((x) => x.key === 'income')
      expect(s.summary).toEqual(calendar)
      expect(income?.actual).toBe(totals.income)
      expect(income?.planned).toBe(calendar.plannedIncome)
      expect(spending.reduce((sum, r) => sum + r.actual, 0)).toBe(totals.expenses)
      expect(spending.reduce((sum, r) => sum + r.planned, 0)).toBe(calendar.plannedExpenses)
    }
    // The card payment is shown with the cards, but moving money doesn't count as spending.
    expect(row('card_payment', card)).toMatchObject({ actual: 10000, count: 1 })
  })
})

describe('recurring rows', () => {
  it('confirm the month’s payment with the amount typed, then change or undo it', () => {
    const rent = recurring()
    expect(row('recurring', rent)).toMatchObject({ planned: 65000, actual: 0, editable: true })

    // Paid early: today, for the payment due on the 31st.
    set({ kind: 'recurring', sourceId: rent, amount: 66000 })
    const [paid] = listTransactions(db).items
    expect(paid).toMatchObject({ date: TODAY, amount: 66000, plannedDate: '2026-10-31' })
    expect(row('recurring', rent)).toMatchObject({ planned: 0, actual: 66000 })

    set({ kind: 'recurring', sourceId: rent, amount: 65000, accountId: cash })
    expect(getTransaction(db, paid.id)).toMatchObject({ amount: 65000, accountId: cash })

    // Removing it leaves the month skipped.
    set({ kind: 'recurring', sourceId: rent, amount: 0 })
    expect(listTransactions(db).items).toEqual([])
    expect(row('recurring', rent)).toBeUndefined()
    expect(row('recurring', rent, '2026-11')).toMatchObject({ planned: 65000 })
  })

  it('leave items due several times a month to their list', () => {
    const weekly = recurring({
      frequency: 'weekly',
      anchorDate: '2026-10-02',
      nextDueDate: '2026-10-02',
      amount: 1000
    })
    expect(row('recurring', weekly)).toMatchObject({ planned: 5000, editable: false })
    expect(() => set({ kind: 'recurring', sourceId: weekly, amount: 1000 })).toThrow(
      /more than once/
    )
  })
})

describe('other rows', () => {
  it('pay a bank loan installment in full, and undo it with 0', () => {
    const loan = createBankLoan(db, {
      counterparty: 'Erste',
      title: 'Car loan',
      principal: 300000,
      interestRate: 0,
      installmentsCount: 3,
      startDate: '2026-08-20',
      firstPaymentDate: '2026-09-15',
      createDisbursementTx: false,
      accountId: debit,
      autoPay: false,
      note: null
    }).id
    expect(() => set({ kind: 'loan', sourceId: loan, amount: 90000 })).toThrow(/paid in full/)
    set({ kind: 'loan', sourceId: loan, amount: 100000 })
    expect(listLoanInstallments(db, loan)[1].paidDate).toBe('2026-10-15')
    expect(row('loan', loan)).toMatchObject({ actual: -100000, planned: 0 })
    set({ kind: 'loan', sourceId: loan, amount: 0 })
    expect(listLoanInstallments(db, loan)[1].paidDate).toBeNull()
  })

  it('pay a card with a summary transfer, pre-filled with what the statement leaves', () => {
    buy('2026-10-20', 20000, 'Shopping', card)
    // The statement closed on 25 October and is due 15 November.
    expect(row('card_payment', card, '2026-11')).toMatchObject({ planned: 20000, actual: 0 })
    set({ kind: 'card_payment', sourceId: card, amount: 15000 })
    const [payment] = listTransactions(db, { kind: 'transfer' }).items
    expect(payment).toMatchObject({
      accountId: debit,
      toAccountId: card,
      amount: 15000,
      date: TODAY,
      title: 'Mastercard payment',
      isMonthTotal: true
    })
    expect(row('card_payment', card, '2026-11')).toMatchObject({ planned: 5000 })
  })

  it('save into a goal with a summary deposit, planned until something goes in', () => {
    const goal = createSavingsGoal(db, {
      name: 'Holiday',
      targetAmount: 200000,
      targetDate: null,
      startingAmount: 0,
      plannedMonthly: 25000,
      color: 'blue'
    }).id
    expect(row('savings', goal)).toMatchObject({ planned: 25000, actual: 0 })
    expect(row('savings', goal, '2026-09')).toMatchObject({ planned: 0 })
    addSavingsMovement(db, {
      goalId: goal,
      type: 'deposit',
      amount: 10000,
      accountId: cash,
      date: '2026-10-05',
      note: null
    })
    set({ kind: 'savings', sourceId: goal, amount: 30000 })
    expect(row('savings', goal)).toMatchObject({
      actual: 30000,
      summary: 20000,
      planned: 0,
      accountId: cash
    })
    expect(() => set({ kind: 'savings', sourceId: goal, amount: 5000 })).toThrow(/already has/)
  })

  it('leave card installments to post by themselves', () => {
    const plan = createInstallmentPlan(db, {
      accountId: card,
      title: 'Laptop',
      categoryId: categoryId('Shopping'),
      totalAmount: 100000,
      count: 4,
      firstDate: '2026-10-30',
      note: null
    }).id
    expect(row('installment_plan', plan)).toMatchObject({ planned: 25000 })
    expect(() => set({ kind: 'installment_plan', sourceId: plan, amount: 25000 })).toThrow(
      /by themselves/
    )
  })
})

describe('copy from last month', () => {
  it('fills empty rows only, never overwriting', () => {
    const groceries = categoryId('Groceries')
    const eatingOut = categoryId('Eating out')
    const transport = categoryId('Transport')
    addMonthRow(db, { categoryId: groceries, accountId: debit })
    addMonthRow(db, { categoryId: eatingOut, accountId: cash })
    set({ month: '2026-09', kind: 'category', sourceId: groceries, amount: 30000 })
    set({ month: '2026-09', kind: 'category', sourceId: eatingOut, amount: 8000 })
    buy('2026-09-12', 4000, 'Transport')
    // October already has groceries.
    buy('2026-10-03', 5000)

    expect(copyFromLastMonth(db, { month: '2026-10' }, TODAY)).toBe(2)
    expect(row('category', groceries)).toMatchObject({ actual: 5000, summary: 0 })
    expect(row('category', eatingOut)).toMatchObject({ actual: 8000, summary: 8000 })
    expect(row('category', transport)).toMatchObject({ actual: 4000, summary: 4000 })
    expect(
      summaries()
        .filter((s) => s.date === TODAY)
        .map((s) => s.account_id)
    ).toEqual([cash, debit])

    // Everything is filled now.
    expect(copyFromLastMonth(db, { month: '2026-10' }, TODAY)).toBe(0)
  })
})

describe('projections', () => {
  it('use typed spending instead of the average in those months', () => {
    updateSettings(db, { projectionIncludeSavings: false, projectionVariableMonths: 1 })
    buy('2026-09-10', 30438) // September's spending: about 10.00 a day on average
    const before = buildProjection(db, { months: 3, granularity: 'month' }, TODAY)
    const november = (p: typeof before): number =>
      p.periods.find((x) => x.start === '2026-11-01')?.variable ?? -1
    expect(november(before)).toBeGreaterThan(0)

    set({ month: '2026-11', kind: 'category', sourceId: categoryId('Groceries'), amount: 50000 })
    const after = buildProjection(db, { months: 3, granularity: 'month' }, TODAY)
    expect(november(after)).toBe(0)
    expect(after.periods.find((x) => x.start === '2026-11-01')?.fixed).toBe(50000)
    // Other months keep the average.
    expect(after.periods.find((x) => x.start === '2026-12-01')?.variable).toBe(
      before.periods.find((x) => x.start === '2026-12-01')?.variable
    )
  })
})
