import type { Database } from 'better-sqlite3'
import {
  addMonths,
  eachDay,
  parseIsoDate,
  startOfMonth,
  today as todayIso,
  type IsoDate
} from '@shared/dates'
import type { SeedSummary } from '@shared/dev'
import type { Cents } from '@shared/money'
import { nextOccurrence, occurrences, type Schedule } from '@shared/recurrence'
import type { TransactionType } from '@shared/transactions'
import { updateSettings } from '../db/repositories/settings'

// Development only (PLAN.md step 13). Fills an empty database with about a year of
// believable data so the views, charts and projections have something to show. Rows are
// written straight against the schema; when a later step adds rules for some of this data,
// update the seeder to follow them.

/** Same seed, same data: every run produces identical amounts and days. */
const SEED = 20261026

/** mulberry32: a small deterministic PRNG returning numbers in [0, 1). */
function random(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Tx {
  date: IsoDate
  title: string
  amount: Cents
  type: TransactionType
  account: number
  to?: number
  category?: string
  recurring?: number
  goal?: number
  loan?: number
  plan?: number
  planned?: IsoDate
  note?: string
}

/** The date of `day` in the month starting at `monthStart` (days up to 28 exist in every month). */
const onDay = (monthStart: IsoDate, day: number): IsoDate =>
  `${monthStart.slice(0, 8)}${String(day).padStart(2, '0')}`

/** Monthly occurrences on `day` from `first` through `until`, and the next one after it. */
function monthly(first: IsoDate, until: IsoDate): { dates: IsoDate[]; next: IsoDate } {
  const dates: IsoDate[] = []
  let date = first
  while (date <= until) {
    dates.push(date)
    date = addMonths(date, 1)
  }
  return { dates, next: date }
}

/**
 * Fills an empty database with demo data covering the 12 months before `today` and the
 * current month so far. Throws if the database already has accounts or transactions.
 */
export function seedDemoData(db: Database, today: IsoDate = todayIso()): SeedSummary {
  const used = db
    .prepare('SELECT (SELECT count(*) FROM accounts) + (SELECT count(*) FROM transactions) AS n')
    .get() as { n: number }
  if (used.n > 0) throw new Error('Demo data only goes into an empty database. Reset it first.')

  const rand = random(SEED)
  /** A whole number of cents between min and max, rounded to 10 cents. */
  const between = (min: number, max: number): Cents =>
    Math.round((min + rand() * (max - min)) / 10) * 10
  const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)]

  const start = addMonths(startOfMonth(today), -12)
  const months = monthly(start, today).dates
  const category = new Map(
    (db.prepare('SELECT id, name FROM categories').all() as { id: number; name: string }[]).map(
      (c) => [c.name, c.id]
    )
  )
  const insert = (sql: string, values: Record<string, unknown>): number =>
    Number(db.prepare(sql).run(values).lastInsertRowid)

  const run = db.transaction((): SeedSummary => {
    // Accounts
    const account = (name: string, type: string, opening: Cents, extra = {}): number =>
      insert(
        `INSERT INTO accounts (name, type, opening_balance, opening_date, credit_limit, statement_day, payment_due_day, color, sort_order)
         VALUES (@name, @type, @opening, @start, @limit, @statement, @due, @color, @order)`,
        {
          name,
          type,
          opening,
          start,
          limit: null,
          statement: null,
          due: null,
          color: { debit: 'blue', cash: 'olive', credit: 'orange' }[type],
          order: { debit: 1, cash: 2, credit: 3 }[type],
          ...extra
        }
      )
    const debit = account('Visa Debit', 'debit', 185000)
    const cash = account('Wallet', 'cash', 8000)
    const card = account('Mastercard', 'credit', 0, { limit: 300000, statement: 25, due: 15 })

    const txs: Tx[] = []

    // Recurring income, bills and subscriptions, with every charge so far
    let recurringItems = 0
    const recurring = (
      kind: 'income' | 'expense' | 'subscription',
      title: string,
      amount: Cents,
      accountId: number,
      categoryName: string,
      first: IsoDate,
      url: string | null = null
    ): void => {
      const schedule: Schedule = {
        frequency: 'monthly',
        interval: 1,
        anchorDate: first,
        endDate: null
      }
      const dates = occurrences(schedule, first, today)
      const next = nextOccurrence(schedule, today)
      const id = insert(
        `INSERT INTO recurring_items (kind, title, amount, account_id, category_id, frequency, anchor_date, next_due_date, auto_post, reminder_days_before, url)
         VALUES (@kind, @title, @amount, @accountId, @categoryId, 'monthly', @first, @next, @autoPost, @reminder, @url)`,
        {
          kind,
          title,
          amount,
          accountId,
          categoryId: category.get(categoryName),
          first,
          next,
          autoPost: kind === 'subscription' ? 0 : 1,
          reminder: kind === 'income' ? null : 2,
          url
        }
      )
      recurringItems++
      for (const date of dates) {
        txs.push({
          date,
          title,
          amount,
          type: kind === 'income' ? 'income' : 'expense',
          account: accountId,
          category: categoryName,
          recurring: id,
          planned: date
        })
      }
    }
    recurring('income', 'Salary', 245000, debit, 'Salary', onDay(start, 10))
    recurring('expense', 'Rent', 65000, debit, 'Rent', onDay(start, 1))
    recurring(
      'subscription',
      'Netflix',
      1399,
      card,
      'Subscriptions',
      onDay(start, 5),
      'https://www.netflix.com'
    )
    recurring(
      'subscription',
      'Spotify',
      1099,
      card,
      'Subscriptions',
      onDay(start, 12),
      'https://www.spotify.com'
    )
    recurring(
      'subscription',
      'Claude',
      2000,
      card,
      'Subscriptions',
      onDay(addMonths(startOfMonth(today), -4), 18),
      'https://claude.ai'
    )

    // Month by month: bills, cash from the ATM, eating out, shopping
    for (const month of months) {
      const at = (day: number): IsoDate | null => {
        const date = onDay(month, day)
        return date >= start && date <= today ? date : null
      }
      const add = (day: number, tx: Omit<Tx, 'date'>): void => {
        const date = at(day)
        if (date) txs.push({ ...tx, date })
      }
      const someDays = (count: number): number[] =>
        Array.from({ length: count }, () => 1 + Math.floor(rand() * 28))

      add(2, {
        title: 'Monthly tram pass',
        amount: 3000,
        type: 'expense',
        account: debit,
        category: 'Transport'
      })
      add(20, {
        title: 'HEP electricity',
        amount: between(4500, 9500),
        type: 'expense',
        account: debit,
        category: 'Utilities'
      })
      add(5, {
        title: 'Cash withdrawal',
        amount: 10000,
        type: 'transfer',
        account: debit,
        to: cash
      })
      add(19, {
        title: 'Cash withdrawal',
        amount: 5000,
        type: 'transfer',
        account: debit,
        to: cash
      })

      for (const day of someDays(5 + Math.floor(rand() * 4))) {
        const inCash = rand() < 0.7
        add(day, {
          title: pick([
            'Pizzeria Mondo',
            'Burek',
            'Coffee',
            'Sushi bar',
            'Lunch with colleagues',
            'Ice cream'
          ]),
          amount: between(450, 4500),
          type: 'expense',
          account: inCash ? cash : debit,
          category: 'Eating out'
        })
      }
      for (const day of someDays(1 + Math.floor(rand() * 2))) {
        add(day, {
          title: pick(['Zara', 'H&M', 'Decathlon', 'Pevex', 'Book store']),
          amount: between(1500, 12000),
          type: 'expense',
          account: card,
          category: 'Shopping'
        })
      }
      for (const day of someDays(1)) {
        add(day, {
          title: 'Pharmacy',
          amount: between(500, 3500),
          type: 'expense',
          account: debit,
          category: 'Health'
        })
        add(Math.min(28, day + 3), {
          title: pick(['Cinema', 'Concert tickets', 'Bowling', 'Steam game']),
          amount: between(800, 4000),
          type: 'expense',
          account: card,
          category: 'Entertainment'
        })
      }
      if (month.slice(5, 7) === '12') {
        add(15, {
          title: 'Christmas bonus',
          amount: 50000,
          type: 'income',
          account: debit,
          category: 'Bonus'
        })
      }
    }

    // Weekly groceries on Saturdays
    for (const date of eachDay(start, today).filter((d) => parseIsoDate(d).getDay() === 6)) {
      const onCard = rand() < 0.2
      txs.push({
        date,
        title: pick(['Lidl', 'Konzum', 'Spar', 'Kaufland']),
        amount: between(3500, 9500),
        type: 'expense',
        account: onCard ? card : debit,
        category: 'Groceries',
        note: rand() < 0.1 ? 'Big shop for the week' : undefined
      })
    }

    // A laptop on the card in 5 installments; the last one takes the leftover cents
    const planFirst = onDay(addMonths(startOfMonth(today), -3), 8)
    const planTotal = 104999
    const planCount = 5
    const plan = insert(
      `INSERT INTO installment_plans (account_id, title, category_id, total_amount, installments_count, first_date)
       VALUES (@card, 'Laptop', @categoryId, @total, @count, @first)`,
      {
        card,
        categoryId: category.get('Shopping'),
        total: planTotal,
        count: planCount,
        first: planFirst
      }
    )
    const rate = Math.floor(planTotal / planCount)
    monthly(planFirst, today)
      .dates.slice(0, planCount)
      .forEach((date, i) => {
        txs.push({
          date,
          title: `Laptop (${i + 1}/${planCount})`,
          amount: i === planCount - 1 ? planTotal - rate * (planCount - 1) : rate,
          type: 'expense',
          account: card,
          category: 'Shopping',
          plan,
          planned: date
        })
      })

    // A savings goal with monthly deposits
    const goalStart = onDay(addMonths(startOfMonth(today), -7), 11)
    const goal = insert(
      `INSERT INTO savings_goals (name, target_amount, target_date, starting_amount, planned_monthly, color, sort_order)
       VALUES ('Summer holiday', 200000, @targetDate, 0, 15000, 'sky', 1)`,
      { targetDate: onDay(addMonths(startOfMonth(today), 8), 1) }
    )
    for (const date of monthly(goalStart, today).dates) {
      txs.push({
        date,
        title: 'Summer holiday',
        amount: 15000,
        type: 'savings_deposit',
        account: debit,
        goal
      })
    }

    // Money lent to a friend, partly paid back in cash
    const loanStart = onDay(addMonths(startOfMonth(today), -5), 6)
    const loan = insert(
      `INSERT INTO loans (kind, title, counterparty, principal, start_date, due_date, account_id, create_disbursement_tx, note)
       VALUES ('lent', 'Loan to Marko', 'Marko', 30000, @start, @due, @debit, 1, 'For his car repair')`,
      { start: loanStart, due: addMonths(loanStart, 8), debit }
    )
    txs.push({
      date: loanStart,
      title: 'Loan to Marko',
      amount: 30000,
      type: 'loan_out',
      account: debit,
      loan
    })
    const repaid = onDay(addMonths(startOfMonth(today), -2), 22)
    if (repaid <= today) {
      txs.push({
        date: repaid,
        title: 'Marko paid back',
        amount: 10000,
        type: 'loan_in',
        account: cash,
        loan
      })
    }

    // Card payments: on each due day (15th), pay everything charged up to the last statement (25th)
    const charges = txs.filter((t) => t.account === card && t.type === 'expense')
    let paid = 0
    for (const month of months.slice(1)) {
      const due = onDay(month, 15)
      if (due > today) break
      const statement = onDay(addMonths(month, -1), 25)
      const billed = charges
        .filter((t) => t.date <= statement)
        .reduce((sum, t) => sum + t.amount, 0)
      if (billed > paid) {
        txs.push({
          date: due,
          title: 'Mastercard payment',
          amount: billed - paid,
          type: 'transfer',
          account: debit,
          to: card
        })
        paid = billed
      }
    }

    // Insert in date order, so newer rows have higher ids like real entries would
    const insertTx = db.prepare(
      `INSERT INTO transactions (date, title, amount, type, account_id, to_account_id, category_id, recurring_item_id,
         savings_goal_id, loan_id, installment_plan_id, planned_date, note)
       VALUES (@date, @title, @amount, @type, @account, @to, @categoryId, @recurring, @goal, @loan, @plan, @planned, @note)`
    )
    const ordered = txs
      .map((t, i) => ({ t, i }))
      .sort((a, b) => (a.t.date < b.t.date ? -1 : a.t.date > b.t.date ? 1 : a.i - b.i))
    for (const { t } of ordered) {
      insertTx.run({
        date: t.date,
        title: t.title,
        amount: t.amount,
        type: t.type,
        account: t.account,
        to: t.to ?? null,
        categoryId: t.category ? category.get(t.category) : null,
        recurring: t.recurring ?? null,
        goal: t.goal ?? null,
        loan: t.loan ?? null,
        plan: t.plan ?? null,
        planned: t.planned ?? null,
        note: t.note ?? null
      })
    }

    updateSettings(db, { onboardingDone: true })

    return {
      from: start,
      to: today,
      accounts: 3,
      transactions: txs.length,
      recurringItems,
      installmentPlans: 1,
      savingsGoals: 1,
      loans: 1
    }
  })

  return run()
}
