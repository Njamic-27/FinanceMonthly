import type { Database } from 'better-sqlite3'
import { amortizationSchedule } from '@shared/amortization'
import { formatDate } from '@shared/dates'
import { installmentTitle } from '@shared/installments'
import {
  bankLoanInputSchema,
  defaultBankLoanTitle,
  payInstallmentInputSchema,
  type BankLoanInput,
  type Loan,
  type LoanInstallment,
  type PayInstallmentInput
} from '@shared/loans'
import type { Transaction } from '@shared/transactions'
import { AppError } from '../../errors'
import { getLoan, listLoanInstallments, syncStatus, usableAccount } from './loans'
import { getSettings } from './settings'
import { getTransaction } from './transactions'
import { t } from '@shared/i18n'

// Bank loans (PLAN.md step 28): an annuity schedule generated on creation, one row per
// monthly installment in loan_installments. An installment is paid once a transaction links
// to it (transactions.loan_installment_id), the single source of truth for paid status.

type ValidBankLoan = ReturnType<typeof bankLoanInputSchema.parse>

function insertSchedule(db: Database, loanId: number, loan: ValidBankLoan): void {
  const insert = db.prepare(
    `INSERT INTO loan_installments (loan_id, seq, due_date, amount, principal_part, interest_part)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
  for (const row of amortizationSchedule(
    loan.principal,
    loan.interestRate,
    loan.installmentsCount,
    loan.firstPaymentDate
  )) {
    insert.run(loanId, row.seq, row.dueDate, row.amount, row.principalPart, row.interestPart)
  }
}

function insertDisbursement(
  db: Database,
  loanId: number,
  title: string,
  loan: ValidBankLoan
): void {
  db.prepare(
    `INSERT INTO transactions (date, title, amount, type, account_id, loan_id)
     VALUES (?, ?, ?, 'loan_in', ?, ?)`
  ).run(loan.startDate, title, loan.principal, loan.accountId, loanId)
}

/**
 * Records a bank loan and generates its schedule. With `createDisbursementTx` the loan money
 * arrives in the account on the start date (leave it off when it went straight to a seller).
 */
export function createBankLoan(db: Database, input: BankLoanInput): Loan {
  const loan = bankLoanInputSchema.parse(input)
  usableAccount(db, loan.accountId, loan.createDisbursementTx ? loan.startDate : null)
  const title = loan.title || defaultBankLoanTitle(loan.counterparty)

  return db.transaction(() => {
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO loans (kind, title, counterparty, principal, interest_rate, start_date,
           installments_count, payment_day, account_id, create_disbursement_tx, auto_pay, note)
         VALUES ('bank_loan', @title, @counterparty, @principal, @interestRate, @startDate,
           @installmentsCount, @paymentDay, @accountId, @createDisbursementTx, @autoPay, @note)`
      )
      .run({
        ...loan,
        title,
        paymentDay: Number(loan.firstPaymentDate.slice(8)),
        createDisbursementTx: Number(loan.createDisbursementTx),
        autoPay: Number(loan.autoPay)
      })
    const id = Number(lastInsertRowid)
    insertSchedule(db, id, loan)
    if (loan.createDisbursementTx) insertDisbursement(db, id, title, loan)
    return getLoan(db, id)
  })()
}

/**
 * Edits a bank loan. While nothing is paid the whole loan can change and its schedule is
 * generated again; once an installment is paid, only the names, account, paying
 * automatically and note can.
 */
export function updateBankLoan(db: Database, id: number, input: BankLoanInput): Loan {
  const current = getLoan(db, id)
  if (current.kind !== 'bank_loan') throw new AppError('validation', t('errors.notBankLoan'))
  const loan = bankLoanInputSchema.parse(input)
  const schedule = listLoanInstallments(db, id)
  const title = loan.title || defaultBankLoanTitle(loan.counterparty)
  const paid = schedule.filter((row) => row.transactionId !== null).length
  const termsChanged =
    loan.principal !== current.principal ||
    loan.interestRate !== current.interestRate ||
    loan.installmentsCount !== current.installmentsCount ||
    loan.startDate !== current.startDate ||
    loan.firstPaymentDate !== schedule[0]?.dueDate ||
    loan.createDisbursementTx !== current.createDisbursementTx

  if (paid > 0 && termsChanged) {
    throw new AppError('validation', t('errors.installmentsPaid', { count: paid }))
  }
  usableAccount(
    db,
    loan.accountId,
    loan.createDisbursementTx && termsChanged ? loan.startDate : null,
    current.accountId
  )

  db.transaction(() => {
    db.prepare(
      `UPDATE loans SET title = @title, counterparty = @counterparty, account_id = @accountId,
         auto_pay = @autoPay, note = @note WHERE id = @id`
    ).run({ ...loan, title, autoPay: Number(loan.autoPay), id })
    // The disbursement keeps the loan's title and account.
    db.prepare(
      `UPDATE transactions SET title = ?, account_id = ?
       WHERE loan_id = ? AND type = 'loan_in' AND loan_installment_id IS NULL`
    ).run(title, loan.accountId, id)

    if (termsChanged) {
      db.prepare(
        `UPDATE loans SET principal = @principal, interest_rate = @interestRate,
           start_date = @startDate, installments_count = @installmentsCount,
           payment_day = @paymentDay, create_disbursement_tx = @createDisbursementTx
         WHERE id = @id`
      ).run({
        ...loan,
        paymentDay: Number(loan.firstPaymentDate.slice(8)),
        createDisbursementTx: Number(loan.createDisbursementTx),
        id
      })
      db.prepare('DELETE FROM loan_installments WHERE loan_id = ?').run(id)
      insertSchedule(db, id, loan)
      db.prepare(
        "DELETE FROM transactions WHERE loan_id = ? AND type = 'loan_in' AND loan_installment_id IS NULL"
      ).run(id)
      if (loan.createDisbursementTx) insertDisbursement(db, id, title, loan)
    }
    syncStatus(db, id)
  })()
  return getLoan(db, id)
}

function getInstallment(db: Database, id: number): LoanInstallment {
  const row = db.prepare('SELECT loan_id FROM loan_installments WHERE id = ?').get(id) as
    { loan_id: number } | undefined
  const installment = row && listLoanInstallments(db, row.loan_id).find((i) => i.id === id)
  if (!installment) throw new AppError('not_found', t('errors.installmentGone'))
  return installment
}

/** Pays one installment: its scheduled amount leaves the account, linked to the installment. */
export function payInstallment(
  db: Database,
  installmentId: number,
  input: PayInstallmentInput
): Transaction {
  const installment = getInstallment(db, installmentId)
  const { accountId, date } = payInstallmentInputSchema.parse(input)
  const loan = getLoan(db, installment.loanId)
  if (installment.transactionId !== null) {
    throw new AppError('conflict', t('errors.installmentPaid', { seq: installment.seq }))
  }
  if (date < loan.startDate) {
    const { locale } = getSettings(db)
    throw new AppError(
      'validation',
      t('errors.loanStarted', { date: formatDate(loan.startDate, locale) })
    )
  }
  usableAccount(db, accountId, date, loan.accountId)

  return db.transaction(() => {
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO transactions (date, title, amount, type, account_id, loan_id,
           loan_installment_id, planned_date)
         VALUES (?, ?, ?, 'loan_out', ?, ?, ?, ?)`
      )
      .run(
        date,
        installmentTitle(loan.title, installment.seq, loan.installmentsCount ?? installment.seq),
        installment.amount,
        accountId,
        loan.id,
        installment.id,
        installment.dueDate
      )
    syncStatus(db, loan.id)
    return getTransaction(db, Number(lastInsertRowid))
  })()
}

/** Undoes an installment's payment: the money goes back and it's due again. */
export function unpayInstallment(db: Database, installmentId: number): void {
  const installment = getInstallment(db, installmentId)
  if (installment.transactionId === null) return
  db.transaction(() => {
    db.prepare('DELETE FROM transactions WHERE id = ?').run(installment.transactionId)
    syncStatus(db, installment.loanId)
  })()
}
