import type Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { createTestDb } from '../db/testing'
import { createAccount, getAccountBalanceSeries } from '../db/repositories/accounts'
import { listCategories } from '../db/repositories/categories'
import { createTransaction } from '../db/repositories/transactions'
import {
  cardReminderMessage,
  cardStatus,
  dueCardReminders,
  markCardNotified,
  type CardReminder
} from './cards'

let db: Database.Database
let debit: number
let card: number

const categoryId = (name: string): number =>
  listCategories(db).find((c) => c.name === name)?.id ?? 0

const spend = (date: string, amount: number): void => {
  createTransaction(db, {
    type: 'expense',
    title: 'Shopping',
    amount,
    date,
    accountId: card,
    categoryId: categoryId('Shopping'),
    note: null
  })
}

const pay = (date: string, amount: number): void => {
  createTransaction(db, {
    type: 'transfer',
    title: '',
    amount,
    date,
    accountId: debit,
    toAccountId: card,
    note: null
  })
}

const newCard = (statementDay: number | null, paymentDueDay: number | null): number =>
  createAccount(db, {
    type: 'credit',
    name: `Card ${statementDay}-${paymentDueDay}`,
    openingBalance: 0,
    openingDate: '2026-01-01',
    color: 'orange',
    creditLimit: 300000,
    statementDay,
    paymentDueDay
  }).id

beforeEach(() => {
  db = createTestDb()
  debit = createAccount(db, {
    type: 'debit',
    name: 'Visa Debit',
    openingBalance: 500000,
    openingDate: '2026-01-01',
    color: 'blue'
  }).id
  // Statement on the 25th, payment due on the 15th of the next month.
  card = newCard(25, 15)
})

describe('cardStatus', () => {
  it('works out what the last statement leaves to pay', () => {
    spend('2026-10-20', 20000)
    spend('2026-10-26', 5000) // on the next statement
    pay('2026-10-26', 8000)
    expect(cardStatus(db, card, '2026-10-27')).toEqual({
      accountId: card,
      limit: 300000,
      owed: 17000,
      available: 283000,
      utilization: 17000 / 300000,
      cycle: {
        lastStatement: '2026-10-25',
        nextStatement: '2026-11-25',
        dueDate: '2026-11-15',
        dueStatement: '2026-10-25'
      },
      statementBalance: 20000,
      paidSinceStatement: 8000,
      leftToPay: 12000
    })
  })

  it('counts refunds as paid and never asks for less than nothing', () => {
    spend('2026-10-20', 20000)
    createTransaction(db, {
      type: 'income',
      title: 'Refund',
      amount: 5000,
      date: '2026-10-26',
      accountId: card,
      categoryId: categoryId('Other income'),
      note: null
    })
    pay('2026-10-27', 30000)
    expect(cardStatus(db, card, '2026-10-27')).toMatchObject({
      owed: 0,
      available: 315000,
      paidSinceStatement: 35000,
      leftToPay: 0
    })
  })

  it('has nothing to pay yet once the due date passed and the next statement is open', () => {
    spend('2026-10-20', 20000)
    expect(cardStatus(db, card, '2026-11-16')).toMatchObject({
      owed: 20000,
      statementBalance: null,
      leftToPay: null,
      cycle: { dueDate: '2026-12-15', dueStatement: '2026-11-25' }
    })
  })

  it('asks for everything owed without a statement day', () => {
    const plain = newCard(null, 15)
    createTransaction(db, {
      type: 'expense',
      title: 'Shopping',
      amount: 4000,
      date: '2026-10-20',
      accountId: plain,
      categoryId: categoryId('Shopping'),
      note: null
    })
    expect(cardStatus(db, plain, '2026-10-27')).toMatchObject({ leftToPay: 4000 })
    expect(cardStatus(db, newCard(null, null), '2026-10-27').leftToPay).toBeNull()
  })

  it('only works for credit cards', () => {
    expect(() => cardStatus(db, debit, '2026-10-27')).toThrow(/isn’t a credit card/)
  })
})

describe('getAccountBalanceSeries', () => {
  it('gives the balance at the end of each day', () => {
    const cash = createAccount(db, {
      type: 'cash',
      name: 'Wallet',
      openingBalance: 100000,
      openingDate: '2026-10-01',
      color: 'olive'
    }).id
    createTransaction(db, {
      type: 'expense',
      title: 'Lunch',
      amount: 5000,
      date: '2026-10-02',
      accountId: cash,
      categoryId: categoryId('Eating out'),
      note: null
    })
    createTransaction(db, {
      type: 'transfer',
      title: '',
      amount: 2000,
      date: '2026-10-03',
      accountId: debit,
      toAccountId: cash,
      note: null
    })
    expect(
      getAccountBalanceSeries(db, { accountId: cash, from: '2026-09-30', to: '2026-10-03' })
    ).toEqual([
      { date: '2026-09-30', balance: 0 },
      { date: '2026-10-01', balance: 100000 },
      { date: '2026-10-02', balance: 95000 },
      { date: '2026-10-03', balance: 97000 }
    ])
  })
})

describe('dueCardReminders', () => {
  const kinds = (today: string): [string, string, number][] =>
    dueCardReminders(db, today).map((r) => [r.kind, r.date, r.amount])

  it('announces a closed statement, then the payment 3 days before it’s due', () => {
    spend('2026-10-20', 20000)
    expect(kinds('2026-10-24')).toEqual([])
    expect(kinds('2026-10-25')).toEqual([['statement', '2026-10-25', 20000]])
    expect(kinds('2026-10-28')).toEqual([['statement', '2026-10-25', 20000]])
    // Missed for more than a few days: no longer news.
    expect(kinds('2026-10-29')).toEqual([])
    expect(kinds('2026-11-11')).toEqual([])
    expect(kinds('2026-11-12')).toEqual([['due', '2026-11-15', 20000]])
    expect(kinds('2026-11-15')).toEqual([['due', '2026-11-15', 20000]])
    expect(kinds('2026-11-16')).toEqual([])
  })

  it('shows each one once', () => {
    spend('2026-10-20', 20000)
    markCardNotified(db, dueCardReminders(db, '2026-10-25'))
    expect(kinds('2026-10-26')).toEqual([])
    markCardNotified(db, dueCardReminders(db, '2026-11-12'))
    expect(kinds('2026-11-13')).toEqual([])
  })

  it('stays quiet when the statement is paid off', () => {
    spend('2026-10-20', 20000)
    pay('2026-10-30', 20000)
    expect(kinds('2026-11-12')).toEqual([])
  })
})

describe('cardReminderMessage', () => {
  const settings = { currency: 'EUR', locale: 'en-GB' }
  const reminder: CardReminder = {
    accountId: 1,
    name: 'Mastercard',
    kind: 'due',
    date: '2026-11-15',
    amount: 28717,
    dueDate: '2026-11-15'
  }

  it('says what to pay and when', () => {
    expect(cardReminderMessage(reminder, settings, '2026-11-14')).toEqual({
      title: 'Mastercard payment due tomorrow',
      body: '€287.17 left to pay on this statement.'
    })
    expect(
      cardReminderMessage(
        { ...reminder, kind: 'statement', date: '2026-10-25' },
        settings,
        '2026-10-25'
      )
    ).toEqual({ title: 'Mastercard statement closed', body: '€287.17 to pay by 15 November.' })
  })
})
