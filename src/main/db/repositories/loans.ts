import type { Database } from 'better-sqlite3'
import { formatDate, today as todayIso, type IsoDate } from '@shared/dates'
import {
  defaultLoanTitle,
  loanIdSchema,
  loanTypes,
  personalLoanInputSchema,
  repaymentInputSchema,
  repaymentTitle,
  settleLoanInputSchema,
  type BankLoanSummary,
  type Loan,
  type LoanInstallment,
  type LoanKind,
  type LoanStatus,
  type PersonalLoanInput,
  type RepaymentInput,
  type SettleLoanInput
} from '@shared/loans'
import { formatMoney } from '@shared/money'
import type { Transaction } from '@shared/transactions'
import { AppError } from '../../errors'
import { getAccount } from './accounts'
import { getSettings } from './settings'
import { getTransaction, toTransaction, type TransactionRow } from './transactions'

interface LoanRow {
  id: number
  kind: LoanKind
  title: string
  counterparty: string
  principal: number
  interest_rate: number | null
  start_date: string
  due_date: string | null
  installments_count: number | null
  payment_day: number | null
  account_id: number | null
  create_disbursement_tx: number
  status: LoanStatus
  note: string | null
  repaid: number
  repayment_count: number
  last_repayment_date: string | null
}

/** Repayments go the other way from the money that started the loan. */
const repaymentType = `CASE l.kind WHEN 'lent' THEN 'loan_in' ELSE 'loan_out' END`

// A bank loan's payments include interest, so what's repaid of it is the principal part of
// its paid installments; a personal loan's is every repayment.
const selectLoans = /* sql */ `
  SELECT l.*,
         CASE l.kind
           WHEN 'bank_loan' THEN
             coalesce((SELECT sum(li.principal_part) FROM loan_installments li
                       WHERE li.loan_id = l.id
                         AND EXISTS (SELECT 1 FROM transactions t WHERE t.loan_installment_id = li.id)), 0)
           ELSE
             coalesce((SELECT sum(t.amount) FROM transactions t
                       WHERE t.loan_id = l.id AND t.type = ${repaymentType}), 0)
         END AS repaid,
         (SELECT count(*) FROM transactions t
          WHERE t.loan_id = l.id AND t.type = ${repaymentType}) AS repayment_count,
         (SELECT max(t.date) FROM transactions t
          WHERE t.loan_id = l.id AND t.type = ${repaymentType}) AS last_repayment_date
  FROM loans l`

interface InstallmentRow {
  id: number
  loan_id: number
  seq: number
  due_date: string
  amount: number
  principal_part: number
  interest_part: number
  transaction_id: number | null
  paid_date: string | null
}

/** A bank loan's schedule in order, each installment with its payment if it's paid. */
export function listLoanInstallments(db: Database, loanId: number): LoanInstallment[] {
  const rows = db
    .prepare(
      `SELECT li.*, t.id AS transaction_id, t.date AS paid_date
       FROM loan_installments li LEFT JOIN transactions t ON t.loan_installment_id = li.id
       WHERE li.loan_id = ? ORDER BY li.seq`
    )
    .all(loanIdSchema.parse(loanId)) as InstallmentRow[]
  const principal = db.prepare('SELECT principal FROM loans WHERE id = ?').get(loanId) as
    { principal: number } | undefined
  let balance = principal?.principal ?? 0
  return rows.map((row) => {
    balance -= row.principal_part
    return {
      id: row.id,
      loanId: row.loan_id,
      seq: row.seq,
      dueDate: row.due_date,
      amount: row.amount,
      principalPart: row.principal_part,
      interestPart: row.interest_part,
      balance,
      transactionId: row.transaction_id,
      paidDate: row.paid_date
    }
  })
}

function bankSummary(db: Database, loanId: number, today: IsoDate): BankLoanSummary | null {
  const rows = listLoanInstallments(db, loanId)
  if (rows.length === 0) return null
  const unpaid = rows.filter((r) => r.transactionId === null)
  const next = unpaid[0]
  return {
    monthlyPayment: rows[0].amount,
    totalInterest: rows.reduce((sum, r) => sum + r.interestPart, 0),
    interestPaid: rows
      .filter((r) => r.transactionId !== null)
      .reduce((sum, r) => sum + r.interestPart, 0),
    paidCount: rows.length - unpaid.length,
    next: next ? { id: next.id, seq: next.seq, dueDate: next.dueDate, amount: next.amount } : null,
    overdueCount: unpaid.filter((r) => r.dueDate < today).length,
    firstPaymentDate: rows[0].dueDate,
    payoffDate: rows[rows.length - 1].dueDate
  }
}

function toLoan(db: Database, row: LoanRow): Loan {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    counterparty: row.counterparty,
    principal: row.principal,
    interestRate: row.interest_rate,
    startDate: row.start_date,
    dueDate: row.due_date,
    installmentsCount: row.installments_count,
    paymentDay: row.payment_day,
    accountId: row.account_id,
    createDisbursementTx: row.create_disbursement_tx === 1,
    status: row.status,
    note: row.note,
    repaid: row.repaid,
    outstanding: row.status === 'written_off' ? 0 : Math.max(0, row.principal - row.repaid),
    repaymentCount: row.repayment_count,
    lastRepaymentDate: row.last_repayment_date,
    bank: row.kind === 'bank_loan' ? bankSummary(db, row.id, todayIso()) : null
  }
}

/** Every loan: active ones first, then by start date, newest first. */
export function listLoans(db: Database): Loan[] {
  const rows = db
    .prepare(`${selectLoans} ORDER BY l.status <> 'active', l.start_date DESC, l.id DESC`)
    .all() as LoanRow[]
  return rows.map((row) => toLoan(db, row))
}

export function getLoan(db: Database, id: number): Loan {
  const row = db.prepare(`${selectLoans} WHERE l.id = ?`).get(loanIdSchema.parse(id)) as
    LoanRow | undefined
  if (!row) throw new AppError('not_found', 'That loan no longer exists.')
  return toLoan(db, row)
}

const money = (db: Database, cents: number): string => {
  const { currency, locale } = getSettings(db)
  return formatMoney(cents, { currency, locale })
}

/**
 * An account the loan may use: not archived (unless it's the one already used) and, when
 * money moves on `date`, already open then.
 */
export function usableAccount(
  db: Database,
  id: number,
  date: IsoDate | null,
  keep?: number | null
): void {
  const account = getAccount(db, id)
  if (account.isArchived && account.id !== keep) {
    throw new AppError('validation', `“${account.name}” is archived. Restore it to use it again.`)
  }
  if (date !== null && date < account.openingDate) {
    const { locale } = getSettings(db)
    throw new AppError(
      'validation',
      `“${account.name}” starts on ${formatDate(account.openingDate, locale)}. Choose that day or later.`
    )
  }
}

/**
 * Paid off once nothing is owed, active again if something is (after an edit or a deleted
 * repayment). A loan written off stays written off.
 */
export function syncStatus(db: Database, id: number): void {
  const loan = getLoan(db, id)
  if (loan.status === 'written_off') return
  const status: LoanStatus = loan.outstanding === 0 ? 'paid_off' : 'active'
  if (status !== loan.status) {
    db.prepare('UPDATE loans SET status = ? WHERE id = ?').run(status, id)
  }
}

/** The transaction that started the loan, if it was recorded. */
function disbursementOf(db: Database, loan: Loan): Transaction | null {
  const row = db
    .prepare('SELECT * FROM transactions WHERE loan_id = ? AND type = ? ORDER BY id LIMIT 1')
    .get(loan.id, loanTypes(loan.kind).disbursement) as TransactionRow | undefined
  return row ? toTransaction(row) : null
}

/**
 * Records money lent to or borrowed from someone. With `createDisbursementTx`, the money
 * leaving (lent) or arriving in (borrowed) the account is recorded too, on the start date.
 */
export function createPersonalLoan(db: Database, input: PersonalLoanInput): Loan {
  const loan = personalLoanInputSchema.parse(input)
  if (loan.accountId !== null) {
    usableAccount(db, loan.accountId, loan.createDisbursementTx ? loan.startDate : null)
  }
  const title = loan.title || defaultLoanTitle(loan.kind, loan.counterparty)

  return db.transaction(() => {
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO loans (kind, title, counterparty, principal, start_date, due_date, account_id,
           create_disbursement_tx, note)
         VALUES (@kind, @title, @counterparty, @principal, @startDate, @dueDate, @accountId,
           @createDisbursementTx, @note)`
      )
      .run({ ...loan, title, createDisbursementTx: Number(loan.createDisbursementTx) })
    const id = Number(lastInsertRowid)
    if (loan.createDisbursementTx) {
      db.prepare(
        `INSERT INTO transactions (date, title, amount, type, account_id, loan_id)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(
        loan.startDate,
        title,
        loan.principal,
        loanTypes(loan.kind).disbursement,
        loan.accountId,
        id
      )
    }
    return getLoan(db, id)
  })()
}

/**
 * Edits a personal loan, keeping its starting transaction in step (added, moved or removed).
 * Lent or borrowed can only change while nothing has been paid back.
 */
export function updatePersonalLoan(db: Database, id: number, input: PersonalLoanInput): Loan {
  const current = getLoan(db, id)
  if (current.kind === 'bank_loan') {
    throw new AppError('validation', 'Bank loans are edited from their own screen.')
  }
  const loan = personalLoanInputSchema.parse(input)
  if (loan.kind !== current.kind && current.repaymentCount > 0) {
    throw new AppError(
      'validation',
      'Something has been paid back already, so it stays a loan you ' +
        (current.kind === 'lent' ? 'lent.' : 'borrowed.')
    )
  }
  if (loan.principal < current.repaid) {
    throw new AppError(
      'validation',
      `${money(db, current.repaid)} has been paid back already. Enter at least that much.`
    )
  }
  const existing = disbursementOf(db, current)
  if (loan.accountId !== null) {
    usableAccount(
      db,
      loan.accountId,
      loan.createDisbursementTx ? loan.startDate : null,
      existing?.accountId ?? current.accountId
    )
  }
  const title = loan.title || defaultLoanTitle(loan.kind, loan.counterparty)

  db.transaction(() => {
    db.prepare(
      `UPDATE loans SET kind = @kind, title = @title, counterparty = @counterparty,
         principal = @principal, start_date = @startDate, due_date = @dueDate,
         account_id = @accountId, create_disbursement_tx = @createDisbursementTx, note = @note
       WHERE id = @id`
    ).run({ ...loan, title, createDisbursementTx: Number(loan.createDisbursementTx), id })

    if (existing) db.prepare('DELETE FROM transactions WHERE id = ?').run(existing.id)
    if (loan.createDisbursementTx) {
      db.prepare(
        `INSERT INTO transactions (date, title, amount, type, account_id, loan_id, note)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        loan.startDate,
        title,
        loan.principal,
        loanTypes(loan.kind).disbursement,
        loan.accountId,
        id,
        existing?.note ?? null
      )
    }
    syncStatus(db, id)
  })()
  return getLoan(db, id)
}

/** Deletes a loan with every transaction recorded for it, as if it never happened. */
export function deleteLoan(db: Database, id: number): void {
  getLoan(db, id)
  db.transaction(() => {
    db.prepare('DELETE FROM transactions WHERE loan_id = ?').run(id)
    db.prepare(
      "DELETE FROM notification_log WHERE source_type = 'loan_installment' AND source_id IN (SELECT id FROM loan_installments WHERE loan_id = ?)"
    ).run(id)
    db.prepare('DELETE FROM loans WHERE id = ?').run(id)
  })()
}

/** Checks a repayment against its loan; `current` is the repayment being edited. */
function checkRepayment(
  db: Database,
  input: RepaymentInput,
  current?: Transaction
): { repayment: ReturnType<typeof repaymentInputSchema.parse>; loan: Loan } {
  const repayment = repaymentInputSchema.parse(input)
  const loan = getLoan(db, repayment.loanId)
  if (loan.kind === 'bank_loan') {
    throw new AppError('validation', 'A bank loan is paid off one installment at a time.')
  }
  if (!current && loan.status !== 'active') {
    throw new AppError(
      'validation',
      `“${loan.title}” is ${loan.status === 'paid_off' ? 'paid off' : 'written off'}. Reopen it to record more.`
    )
  }
  if (repayment.date < loan.startDate) {
    const { locale } = getSettings(db)
    throw new AppError(
      'validation',
      `The loan started on ${formatDate(loan.startDate, locale)}. Choose that day or later.`
    )
  }
  usableAccount(db, repayment.accountId, repayment.date, current?.accountId)
  const owed = loan.principal - loan.repaid + (current?.loanId === loan.id ? current.amount : 0)
  if (repayment.amount > owed) {
    throw new AppError('validation', `Only ${money(db, Math.max(0, owed))} is still owed.`)
  }
  return { repayment, loan }
}

/** Records money paid back: to you on a loan you gave, by you on one you took. */
export function addRepayment(db: Database, input: RepaymentInput): Transaction {
  const { repayment, loan } = checkRepayment(db, input)
  return db.transaction(() => {
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO transactions (date, title, amount, type, account_id, loan_id, note)
         VALUES (@date, @title, @amount, @type, @accountId, @loanId, @note)`
      )
      .run({
        ...repayment,
        title: repaymentTitle(loan.kind, loan.counterparty),
        type: loanTypes(loan.kind).repayment
      })
    syncStatus(db, loan.id)
    return getTransaction(db, Number(lastInsertRowid))
  })()
}

function getRepayment(db: Database, id: number): Transaction {
  const tx = getTransaction(db, id)
  const loan = tx.loanId === null ? null : getLoan(db, tx.loanId)
  if (!loan || tx.type !== loanTypes(loan.kind).repayment) {
    throw new AppError('validation', 'That isn’t a loan repayment.')
  }
  return tx
}

export function updateRepayment(db: Database, id: number, input: RepaymentInput): Transaction {
  const current = getRepayment(db, id)
  if (current.loanInstallmentId !== null) {
    throw new AppError(
      'validation',
      'An installment is paid as scheduled. Undo the payment and pay it again to change it.'
    )
  }
  const { repayment } = checkRepayment(db, { ...input, loanId: current.loanId ?? 0 }, current)
  db.transaction(() => {
    db.prepare(
      `UPDATE transactions SET date = @date, amount = @amount, account_id = @accountId, note = @note
       WHERE id = @id`
    ).run({ ...repayment, id })
    syncStatus(db, repayment.loanId)
  })()
  return getTransaction(db, id)
}

export function deleteRepayment(db: Database, id: number): void {
  const tx = getRepayment(db, id)
  db.transaction(() => {
    db.prepare('DELETE FROM transactions WHERE id = ?').run(id)
    syncStatus(db, tx.loanId as number)
  })()
}

/**
 * Closes a loan that still has something owed: the rest is paid (recorded as a final
 * repayment) or let go (written off, no money moves).
 */
export function settleLoan(db: Database, id: number, input: SettleLoanInput): Loan {
  const loan = getLoan(db, id)
  const how = settleLoanInputSchema.parse(input)
  if (loan.kind === 'bank_loan') {
    throw new AppError('validation', 'A bank loan is paid off one installment at a time.')
  }
  if (loan.status !== 'active') {
    throw new AppError('validation', `“${loan.title}” is already closed.`)
  }
  if (how.how === 'repaid') {
    addRepayment(db, {
      loanId: id,
      amount: loan.outstanding,
      accountId: how.accountId,
      date: how.date,
      note: null
    })
  } else {
    db.prepare("UPDATE loans SET status = 'written_off' WHERE id = ?").run(id)
  }
  return getLoan(db, id)
}

/** Opens a closed loan again: a written-off one owes its rest again. */
export function reopenLoan(db: Database, id: number): Loan {
  const loan = getLoan(db, id)
  if (loan.status === 'active') return loan
  if (loan.principal - loan.repaid <= 0) {
    throw new AppError('validation', 'Everything has been paid back, so there’s nothing to reopen.')
  }
  db.prepare("UPDATE loans SET status = 'active' WHERE id = ?").run(id)
  return getLoan(db, id)
}

/** Every transaction recorded for a loan, newest first. */
export function listLoanTransactions(db: Database, id: number): Transaction[] {
  const rows = db
    .prepare('SELECT * FROM transactions WHERE loan_id = ? ORDER BY date DESC, id DESC')
    .all(loanIdSchema.parse(id)) as TransactionRow[]
  return rows.map(toTransaction)
}
