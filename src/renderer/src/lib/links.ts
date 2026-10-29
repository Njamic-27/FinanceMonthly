import type { DateRange, IsoDate, PeriodKind } from '@shared/dates'
import { plannedRowPath } from '@shared/month'
import type { PlannedItem } from '@shared/planned'
import type { Milestone } from '@shared/projection'
import type { Transaction } from '@shared/transactions'
import { overviewParams } from '@renderer/features/overview/period'
import { writeFilters } from '@renderer/features/transactions/filters'

// Where each kind of thing opens. Screens link through these, so a day, an account or a loan
// opens the same place wherever it's mentioned. (A transaction opens its edit dialog instead:
// `openTransactionDialog`.)

/** A day in the Calendar, its panel open. */
export const dayPath = (date: IsoDate): string =>
  `/calendar?${new URLSearchParams({ month: date.slice(0, 7), day: date })}`

/** A past or current week or month in Overview. */
export const periodPath = (kind: PeriodKind, date: IsoDate): string =>
  `/overview?${overviewParams(kind, date)}`

export const accountPath = (id: number): string => `/accounts/${id}`

/** Transactions in a category, within a period when there is one. */
export const categoryPath = (id: number, range?: DateRange): string =>
  `/transactions?${writeFilters({ search: '', categoryId: id, from: range?.start, to: range?.end })}`

/** A subscription, recurring income or recurring expense, open for editing. */
export const recurringPath = (id: number): string => `/recurring?edit=${id}`

export const goalPath = (id: number): string => `/savings/${id}`

export const loanPath = (id: number): string => `/loans/${id}`

/**
 * A planned payment's row on Month, in the month it counts in, where it's paid, confirmed or
 * changed (PLAN.md step 47).
 */
export const plannedPath = (item: PlannedItem): string => plannedRowPath(item)

/**
 * Where a transaction the transaction dialog doesn't edit is changed: savings deposits and
 * withdrawals on their goal, loan payments on their loan. Null for the ones it edits.
 */
export function ownerPath(tx: Transaction): string | null {
  if (tx.savingsGoalId !== null) return goalPath(tx.savingsGoalId)
  if (tx.loanId !== null) return loanPath(tx.loanId)
  return null
}

/** What a milestone refers to: its loan, card or goal, or else its day in the Calendar. */
export function milestonePath(milestone: Milestone): string {
  switch (milestone.kind) {
    case 'loan_paid_off':
      return loanPath(milestone.sourceId)
    case 'plan_paid_off':
      return milestone.accountId ? accountPath(milestone.accountId) : dayPath(milestone.date)
    case 'goal_reached':
      return goalPath(milestone.sourceId)
    case 'below_zero':
      return dayPath(milestone.date)
  }
}
