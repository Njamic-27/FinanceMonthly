import type { Cents } from '@shared/money'
import {
  monthRowKey,
  renamableRowKinds,
  type MonthSectionKey,
  type MonthSheetRow
} from '@shared/month'

// What the Month sheet's cells show, and when typing into one saves something.

export const rowKey = (row: Pick<MonthSheetRow, 'kind' | 'sourceId'>): string => monthRowKey(row)

export const sectionTitles: Record<MonthSectionKey, string> = {
  income: 'Income',
  subscriptions: 'Subscriptions',
  bills: 'Bills',
  everyday: 'Everyday',
  loans: 'Loans',
  savings: 'Savings',
  cards: 'Credit card bills'
}

export const sectionEmpty: Record<MonthSectionKey, string> = {
  income: 'No income this month yet.',
  subscriptions: 'No subscriptions this month.',
  bills: 'No bills this month.',
  everyday: 'No everyday spending this month yet.',
  cards: 'No credit cards.',
  loans: 'No loan payments this month.',
  savings: 'No savings goals.'
}

/** Sections that need a word on how they count. */
export const sectionNotes: Partial<Record<MonthSectionKey, string>> = {
  cards:
    'Each card’s bill this month. Its purchases are already in their groups above, so it isn’t counted again.',
  loans: 'Loans change your balance but aren’t income or spending.',
  savings: 'Money put aside from your accounts, not spending.'
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
      return 'Open the row to pay an installment or record a repayment.'
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

/** The groups under Money out, top to bottom (Income comes first, above a divider). */
export const moneyOutSections: readonly MonthSectionKey[] = [
  'subscriptions',
  'bills',
  'everyday',
  'loans',
  'savings',
  'cards'
]

/**
 * An amount as the sheet shows it: money in +, money out −. Loan rows already carry their sign
 * (+ borrowed, − repaid), and a savings row that took more out than it put in shows +.
 */
export function signedAmount(section: MonthSectionKey, amount: Cents): Cents {
  if (section === 'loans') return amount
  return section === 'income' ? amount : -amount
}

/**
 * How an amount reads on the sheet. The headings say which way money goes, so amounts are
 * plain; only money coming in under Expenses (money borrowed, savings taken out) gets a "+".
 */
export function sheetAmount(
  section: MonthSectionKey,
  amount: Cents
): { value: Cents; plus: boolean } {
  const signed = signedAmount(section, amount)
  return { value: Math.abs(signed), plus: section !== 'income' && signed > 0 }
}

/** A dialog "+" opens to add something new (see addMenuEntries.ts). */
export type AddChoice = 'card' | 'bank_loan' | 'borrowed' | 'lent' | 'goal' | 'account' | 'transfer'

export const canRename = (row: MonthSheetRow): boolean =>
  (renamableRowKinds as readonly string[]).includes(row.kind)

/** Category rows can be hidden and moved; the others come and go with their items. */
export const isCategoryRow = (row: MonthSheetRow): boolean => row.kind === 'category'

/** A section's category ids with `id` moved to `to` (an index among them). */
export function moveCategory(ids: number[], id: number, to: number): number[] {
  const rest = ids.filter((other) => other !== id)
  const index = Math.max(0, Math.min(rest.length, to))
  return [...rest.slice(0, index), id, ...rest.slice(index)]
}
