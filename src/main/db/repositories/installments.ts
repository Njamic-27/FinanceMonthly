import type { Database } from 'better-sqlite3'
import { accountIdSchema } from '@shared/accounts'
import { formatDate, type IsoDate } from '@shared/dates'
import {
  installmentPlanIdSchema,
  installmentPlanInputSchema,
  installmentSchedule,
  splitInstallments,
  type InstallmentPlan,
  type InstallmentPlanInput
} from '@shared/installments'
import { AppError } from '../../errors'
import { getAccount } from './accounts'
import { getCategory } from './categories'
import { getSettings } from './settings'

interface PlanRow {
  id: number
  account_id: number
  title: string
  category_id: number
  total_amount: number
  installments_count: number
  first_date: string
  note: string | null
  posted_count: number
}

const selectPlans = /* sql */ `
  SELECT p.*,
         (SELECT count(*) FROM transactions t WHERE t.installment_plan_id = p.id) AS posted_count
  FROM installment_plans p`

function toPlan(row: PlanRow): InstallmentPlan {
  const schedule = installmentSchedule(row.total_amount, row.installments_count, row.first_date)
  const [installment] = splitInstallments(row.total_amount, row.installments_count)
  // Installments post in order, so the first `posted_count` are charged.
  const unposted = schedule.slice(row.posted_count)
  return {
    id: row.id,
    accountId: row.account_id,
    title: row.title,
    categoryId: row.category_id,
    totalAmount: row.total_amount,
    count: row.installments_count,
    firstDate: row.first_date,
    note: row.note,
    installment,
    lastInstallment: schedule[schedule.length - 1].amount,
    postedCount: row.posted_count,
    remaining: unposted.reduce((sum, i) => sum + i.amount, 0),
    nextDate: unposted[0]?.date ?? null,
    lastDate: schedule[schedule.length - 1].date
  }
}

/** Plans on one card, or on every card; the newest first. */
export function listInstallmentPlans(db: Database, accountId?: number): InstallmentPlan[] {
  const rows = (
    accountId === undefined
      ? db.prepare(`${selectPlans} ORDER BY p.first_date DESC, p.id DESC`).all()
      : db
          .prepare(`${selectPlans} WHERE p.account_id = ? ORDER BY p.first_date DESC, p.id DESC`)
          .all(accountIdSchema.parse(accountId))
  ) as PlanRow[]
  return rows.map(toPlan)
}

export function getInstallmentPlan(db: Database, id: number): InstallmentPlan {
  const row = db.prepare(`${selectPlans} WHERE p.id = ?`).get(installmentPlanIdSchema.parse(id)) as
    PlanRow | undefined
  if (!row) throw new AppError('not_found', 'That installment plan no longer exists.')
  return toPlan(row)
}

/**
 * Records a purchase paid in installments on a credit card. Nothing is charged here: the
 * posting service charges each installment on its date, the first one included.
 */
export function createInstallmentPlan(db: Database, input: InstallmentPlanInput): InstallmentPlan {
  const plan = installmentPlanInputSchema.parse(input)

  const account = getAccount(db, plan.accountId)
  if (account.type !== 'credit') {
    throw new AppError('validation', 'Only purchases on a credit card can be paid in installments.')
  }
  if (account.isArchived) {
    throw new AppError('validation', `“${account.name}” is archived. Restore it to use it again.`)
  }
  if (plan.firstDate < account.openingDate) {
    const { locale } = getSettings(db)
    throw new AppError(
      'validation',
      `“${account.name}” starts on ${formatDate(account.openingDate, locale)}. Choose a later date, or move the card’s starting date back first.`
    )
  }
  const category = getCategory(db, plan.categoryId)
  if (category.type !== 'expense' || category.isArchived) {
    throw new AppError('validation', 'Choose an expense category that isn’t archived.')
  }

  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO installment_plans (account_id, title, category_id, total_amount, installments_count, first_date, note)
       VALUES (@accountId, @title, @categoryId, @totalAmount, @count, @firstDate, @note)`
    )
    .run({ ...plan, title: plan.title || category.name })
  return getInstallmentPlan(db, Number(lastInsertRowid))
}

/** Deletes a purchase and every installment already charged for it, as if it never happened. */
export function deleteInstallmentPlan(db: Database, id: number): void {
  getInstallmentPlan(db, id)
  db.transaction(() => {
    db.prepare('DELETE FROM transactions WHERE installment_plan_id = ?').run(id)
    db.prepare(
      "DELETE FROM notification_log WHERE source_type = 'installment_plan' AND source_id = ?"
    ).run(id)
    db.prepare('DELETE FROM installment_plans WHERE id = ?').run(id)
  })()
}

/** Installment dates of a plan that a transaction already charges. */
export function chargedDates(db: Database, planId: number): Set<IsoDate> {
  const rows = db
    .prepare('SELECT planned_date AS date FROM transactions WHERE installment_plan_id = ?')
    .all(planId) as { date: IsoDate }[]
  return new Set(rows.map((r) => r.date))
}
