import type Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import type { UpcomingPayment } from '@shared/planned'
import type { RecurringItemInput } from '@shared/recurring'
import { createTestDb } from '../db/testing'
import { createAccount } from '../db/repositories/accounts'
import { listCategories } from '../db/repositories/categories'
import { createRecurringItem } from '../db/repositories/recurring'
import { postOccurrence, setItemActive } from './posting'
import { dueReminders, markNotified, reminderMessages, upcomingPayments } from './reminders'

// Monday 26 October 2026.
const TODAY = '2026-10-26'

let db: Database.Database
let card: number

const subscription = (overrides: Partial<RecurringItemInput> = {}): number =>
  createRecurringItem(db, {
    kind: 'subscription',
    title: 'Netflix',
    amount: 1399,
    accountId: card,
    categoryId: listCategories(db).find((c) => c.name === 'Subscriptions')?.id ?? 0,
    frequency: 'monthly',
    interval: 1,
    anchorDate: '2026-10-28',
    nextDueDate: '2026-10-28',
    autoPost: false,
    reminderDaysBefore: 2,
    ...overrides
  }).id

const titles = (today: string): [string, string][] =>
  dueReminders(db, today).map((r) => [r.planned.title, r.planned.date])

beforeEach(() => {
  db = createTestDb()
  card = createAccount(db, {
    type: 'credit',
    name: 'Mastercard',
    openingBalance: 0,
    openingDate: '2026-01-01',
    color: 'orange',
    creditLimit: 300000,
    statementDay: null,
    paymentDueDay: null
  }).id
})

describe('dueReminders', () => {
  it('goes off on its day and stays until announced', () => {
    subscription()
    expect(titles('2026-10-25')).toEqual([])
    expect(titles('2026-10-26')).toEqual([['Netflix', '2026-10-28']])
    expect(titles('2026-10-27')).toEqual([['Netflix', '2026-10-28']])
  })

  it('never repeats one that was announced', () => {
    subscription()
    markNotified(
      db,
      dueReminders(db, TODAY).map((r) => r.planned)
    )
    expect(titles(TODAY)).toEqual([])
    markNotified(
      db,
      upcomingPayments(db, TODAY).map((r) => r.planned)
    )
    // The next month's payment gets its own reminder.
    expect(titles('2026-11-26')).toEqual([['Netflix', '2026-11-28']])
  })

  it('reminds on the day itself, and not after the due date', () => {
    subscription({ title: 'Spotify', reminderDaysBefore: 0 })
    expect(titles('2026-10-27')).toEqual([])
    expect(titles('2026-10-28')).toEqual([['Spotify', '2026-10-28']])
    expect(titles('2026-10-29')).toEqual([])
  })

  it('skips items without a reminder, paused ones and payments already made', () => {
    subscription({ title: 'Silent', reminderDaysBefore: null })
    const paused = subscription({ title: 'Paused' })
    setItemActive(db, paused, false, TODAY)
    const paid = subscription({ title: 'Paid early' })
    postOccurrence(db, {
      itemId: paid,
      plannedDate: '2026-10-28',
      date: TODAY,
      amount: 1399,
      accountId: card
    })
    expect(titles(TODAY)).toEqual([])
  })

  it('looks as far ahead as the longest reminder', () => {
    subscription({
      title: 'Insurance',
      frequency: 'yearly',
      anchorDate: '2026-11-25',
      nextDueDate: '2026-11-25',
      reminderDaysBefore: 30
    })
    expect(titles(TODAY)).toEqual([['Insurance', '2026-11-25']])
  })
})

describe('upcomingPayments', () => {
  it('lists the next 14 days with each reminder', () => {
    subscription()
    subscription({
      title: 'Gym',
      reminderDaysBefore: null,
      anchorDate: '2026-11-08',
      nextDueDate: '2026-11-08'
    })
    subscription({ title: 'Later', anchorDate: '2026-11-09', nextDueDate: '2026-11-09' })
    markNotified(
      db,
      dueReminders(db, TODAY).map((r) => r.planned)
    )

    expect(
      upcomingPayments(db, TODAY).map((p) => [
        p.planned.title,
        p.planned.date,
        p.remindOn,
        p.notified
      ])
    ).toEqual([
      ['Netflix', '2026-10-28', '2026-10-26', true],
      ['Gym', '2026-11-08', null, false]
    ])
  })
})

describe('reminderMessages', () => {
  const settings = { currency: 'EUR', locale: 'en-GB' }
  const accounts = new Map([[1, 'Mastercard']])
  const reminder = (
    title: string,
    date: string,
    group: 'income' | 'expense' = 'expense'
  ): UpcomingPayment => ({
    planned: {
      source: 'recurring' as const,
      sourceId: 1,
      date,
      countsOn: date,
      title,
      amount: 1399,
      group,
      accountId: 1,
      categoryId: null,
      overdue: false
    },
    reminderDaysBefore: 2,
    remindOn: TODAY,
    notified: false
  })

  it('says when each payment is due', () => {
    expect(
      reminderMessages(
        [
          reminder('Netflix', '2026-10-26'),
          reminder('Spotify', '2026-10-27'),
          reminder('Salary', '2026-10-30', 'income')
        ],
        accounts,
        settings,
        TODAY
      )
    ).toEqual([
      { title: 'Netflix is due today', body: '€13.99 · Mastercard', path: '/' },
      { title: 'Spotify is due tomorrow', body: '€13.99 · Mastercard', path: '/' },
      {
        title: 'Salary arrives on Friday 30 Oct',
        body: '€13.99 · Mastercard',
        path: '/'
      }
    ])
  })

  it('rolls many into one notification', () => {
    const many = ['A', 'B', 'C', 'D', 'E'].map((t) => reminder(t, '2026-10-27'))
    expect(reminderMessages(many, accounts, settings, TODAY)).toEqual([
      {
        title: '5 payments coming up',
        body: 'A €13.99, tomorrow\nB €13.99, tomorrow\nC €13.99, tomorrow\nand 2 more',
        path: '/'
      }
    ])
  })
})
