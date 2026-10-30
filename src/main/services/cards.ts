import type { Database } from 'better-sqlite3'
import {
  CARD_BILL_NOTICE_DAYS,
  CARD_DUE_REMINDER_DAYS,
  cardCycle,
  type CardBillDue,
  type CardStatus
} from '@shared/cards'
import {
  addDays,
  addMonths,
  dayOfMonth,
  daysBetween,
  formatDate,
  startOfMonth,
  type IsoDate
} from '@shared/dates'
import { formatMoney } from '@shared/money'
import type { CardDueMarker } from '@shared/planned'
import type { Settings } from '@shared/settings'
import { AppError } from '../errors'
import { incomingTypes } from '../db/ledger'
import { getAccount, listAccounts } from '../db/repositories/accounts'
import { when } from './when'
import { t } from '@shared/i18n'

// Credit cards (PLAN.md step 24): what's used and available, where the card is in its
// statement cycle, and reminders when a statement closes and before its payment is due.

const owedOn = (balance: number): number => Math.max(0, -balance)

/** Usage, cycle and what to pay next for a credit card, as of `today`. */
/**
 * Card bills to pay now (PLAN.md step 49): each active card whose payment is due within
 * CARD_BILL_NOTICE_DAYS, or overdue, with something left to pay on its statement.
 */
export function cardBillsDue(db: Database, today: IsoDate): CardBillDue[] {
  const until = addDays(today, CARD_BILL_NOTICE_DAYS)
  return listAccounts(db, today)
    .filter((a) => a.type === 'credit' && !a.isArchived)
    .flatMap((card): CardBillDue[] => {
      const status = cardStatus(db, card.id, today)
      const due = status.cycle.dueDate
      if (!due || due > until || !status.leftToPay || status.leftToPay <= 0) return []
      return [
        {
          accountId: card.id,
          name: card.name,
          dueDate: due,
          amount: status.leftToPay,
          payFromAccountId: card.payFromAccountId
        }
      ]
    })
}

export function cardStatus(db: Database, accountId: number, today: IsoDate): CardStatus {
  const account = getAccount(db, accountId, today)
  if (account.type !== 'credit') {
    throw new AppError('validation', t('errors.notCard', { name: account.name }))
  }
  const limit = account.creditLimit ?? 0
  const owed = owedOn(account.balance)
  const cycle = cardCycle(account.statementDay, account.paymentDueDay, today)

  let statementBalance: number | null = null
  let paidSinceStatement: number | null = null
  let leftToPay: number | null = null
  if (cycle.dueStatement !== null && cycle.dueStatement <= today) {
    statementBalance = owedOn(getAccount(db, accountId, cycle.dueStatement).balance)
    // Money into the card after the statement: payments (transfers in) and refunds.
    const { paid } = db
      .prepare(
        `SELECT coalesce(sum(t.amount), 0) AS paid FROM transactions t
         WHERE t.date > @from AND t.date <= @to
           AND (t.to_account_id = @id
                OR (t.account_id = @id AND t.type IN (${incomingTypes.map((type) => `'${type}'`).join(', ')})))`
      )
      .get({ id: accountId, from: cycle.dueStatement, to: today }) as { paid: number }
    paidSinceStatement = paid
    leftToPay = Math.max(0, statementBalance - paid)
  } else if (cycle.dueDate !== null && cycle.dueStatement === null) {
    // No statement day: everything owed is due.
    leftToPay = owed
  }

  return {
    accountId,
    limit,
    owed,
    available: account.available ?? limit + account.balance,
    reserved: account.reserved ?? 0,
    utilization: limit > 0 ? owed / limit : 0,
    cycle,
    statementBalance,
    paidSinceStatement,
    leftToPay
  }
}

/** A card reminder to show: a statement that closed, or a payment due soon. */
export interface CardReminder {
  accountId: number
  name: string
  kind: 'statement' | 'due'
  /** The statement's closing date, or the payment's due date. Logged so it shows once. */
  date: IsoDate
  amount: number
  dueDate: IsoDate | null
}

/** How long after a statement closes its notice may still show (if the app was closed). */
const STATEMENT_NOTICE_DAYS = 3

const logged = (db: Database, accountId: number, date: IsoDate): boolean =>
  !!db
    .prepare(
      "SELECT 1 FROM notification_log WHERE source_type = 'card_due' AND source_id = ? AND due_date = ?"
    )
    .get(accountId, date)

/**
 * Card reminders to show now: each active card's payment from 3 days before it's due, and a
 * statement that closed in the last few days, while there's something to pay. Both are logged
 * under 'card_due' by their date, so each shows once. A payment due soon replaces the notice
 * for the statement it pays.
 */
export function dueCardReminders(db: Database, today: IsoDate): CardReminder[] {
  const reminders: CardReminder[] = []
  for (const account of listAccounts(db, today)) {
    if (account.type !== 'credit' || account.isArchived) continue
    const status = cardStatus(db, account.id, today)
    const { dueDate, dueStatement } = status.cycle
    const toPay = status.leftToPay ?? 0
    if (toPay <= 0) continue

    if (dueDate && daysBetween(today, dueDate) <= CARD_DUE_REMINDER_DAYS) {
      if (!logged(db, account.id, dueDate)) {
        reminders.push({
          accountId: account.id,
          name: account.name,
          kind: 'due',
          date: dueDate,
          amount: toPay,
          dueDate
        })
      }
    } else if (
      dueStatement &&
      dueStatement <= today &&
      dueStatement >= addDays(today, -STATEMENT_NOTICE_DAYS) &&
      !logged(db, account.id, dueStatement)
    ) {
      reminders.push({
        accountId: account.id,
        name: account.name,
        kind: 'statement',
        date: dueStatement,
        amount: toPay,
        dueDate
      })
    }
  }
  return reminders
}

export function markCardNotified(db: Database, reminders: CardReminder[]): void {
  const insert = db.prepare(
    `INSERT INTO notification_log (source_type, source_id, due_date) VALUES ('card_due', ?, ?)
     ON CONFLICT DO NOTHING`
  )
  db.transaction(() => {
    for (const r of reminders) insert.run(r.accountId, r.date)
  })()
}

/** The notification text for a card reminder. */
export function cardReminderMessage(
  reminder: CardReminder,
  settings: Pick<Settings, 'currency' | 'locale'>,
  today: IsoDate
): { title: string; body: string } {
  const amount = formatMoney(reminder.amount, settings)
  if (reminder.kind === 'due') {
    return {
      title: t('reminder.cardDue', {
        card: reminder.name,
        when: when(reminder.date, today, settings.locale)
      }),
      body: t('reminder.cardLeft', { amount })
    }
  }
  return {
    title: t('reminder.statementClosed', { card: reminder.name }),
    body: reminder.dueDate
      ? t('reminder.toPayBy', {
          amount,
          date: formatDate(reminder.dueDate, settings.locale, { day: 'numeric', month: 'long' })
        })
      : t('reminder.toPay', { amount })
  }
}

/**
 * Every active card's payment due dates from `from` to `to`, for the Calendar. The amount is
 * known only for the payment of a statement that has closed (what's left to pay on it).
 */
export function cardDueMarkers(
  db: Database,
  from: IsoDate,
  to: IsoDate,
  today: IsoDate
): CardDueMarker[] {
  const markers: CardDueMarker[] = []
  for (const account of listAccounts(db, today)) {
    if (account.type !== 'credit' || account.isArchived || account.paymentDueDay === null) continue
    const { cycle, leftToPay } = cardStatus(db, account.id, today)
    for (let month = startOfMonth(from); month <= to; month = addMonths(month, 1)) {
      const date = dayOfMonth(month, account.paymentDueDay)
      if (date < from || date > to || date < account.openingDate) continue
      markers.push({
        accountId: account.id,
        name: account.name,
        date,
        amount: date === cycle.dueDate ? leftToPay : null
      })
    }
  }
  return markers.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name))
}
