import type { Cents } from '@shared/money'
import type { MonthSectionKey, MonthSheetRow } from '@shared/month'

// What the Month sheet's cells show, and when typing into one saves something.

export const rowKey = (row: Pick<MonthSheetRow, 'kind' | 'sourceId'>): string =>
  `${row.kind}:${row.sourceId}`

export const sectionTitles: Record<MonthSectionKey, string> = {
  income: 'Income',
  expenses: 'Expenses',
  subscriptions: 'Subscriptions',
  cards: 'Credit cards',
  loans: 'Loans',
  savings: 'Savings'
}

export const sectionEmpty: Record<MonthSectionKey, string> = {
  income: 'No income this month yet.',
  expenses: 'No spending this month yet.',
  subscriptions: 'No subscriptions this month.',
  cards: 'No credit cards.',
  loans: 'No loan payments this month.',
  savings: 'No savings goals.'
}

/** Sections whose money isn't income or spending, and why. */
export const sectionNotes: Partial<Record<MonthSectionKey, string>> = {
  cards: 'Paying a card moves money between your accounts, so only installments count as spending.',
  loans: 'Loans change your balance but aren’t income or spending.'
}

/** What a cell shows: what's recorded, or what's planned while nothing is. */
export function cellValue(row: MonthSheetRow): { amount: Cents; planned: boolean } {
  return row.count === 0 && row.planned !== 0
    ? { amount: row.planned, planned: true }
    : { amount: row.actual, planned: false }
}

/** Loan rows show money out as negative; their cells take the installment as typed. */
const typed = (row: MonthSheetRow, amount: Cents): Cents =>
  row.kind === 'loan' ? Math.abs(amount) : amount

/** The amount a cell's field starts with, or null when it starts empty. */
export function editStart(row: MonthSheetRow): Cents | null {
  const { amount } = cellValue(row)
  return amount === 0 ? null : typed(row, amount)
}

/**
 * Whether typing `amount` into the row does something: it changes the amount, or confirms
 * (or, with 0, skips) a payment that is only planned.
 */
export function needsSaving(row: MonthSheetRow, amount: Cents): boolean {
  const { amount: shown, planned } = cellValue(row)
  return planned || amount !== typed(row, shown)
}

/** The amount a cell shows while `amount` is being saved. */
export const savingValue = (row: MonthSheetRow, amount: Cents): Cents =>
  row.kind === 'loan' ? -amount : amount

/** Why a row can't be typed into, for its cell's tooltip; null when it can. */
export function lockedReason(row: MonthSheetRow): string | null {
  if (row.editable) return null
  switch (row.kind) {
    case 'installment_plan':
      return 'Card installments are charged by themselves on their dates.'
    case 'loan':
      return 'Record this loan’s repayments on its page.'
    case 'recurring':
      return 'Due more than once this month: change each payment in its list.'
    default:
      return 'This row can’t take an amount.'
  }
}

/** The short line beside a row's name. */
export function rowNote(row: MonthSheetRow): string | null {
  const parts: string[] = []
  if (row.kind === 'installment_plan') parts.push('Charged automatically')
  if (row.overdue) parts.push('Overdue')
  if (row.count > 1) parts.push(`${row.count} transactions`)
  return parts.length > 0 ? parts.join(' · ') : null
}
