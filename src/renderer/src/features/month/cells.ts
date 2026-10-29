import type { Cents } from '@shared/money'
import { renamableRowKinds, type MonthSectionKey, type MonthSheetRow } from '@shared/month'
import type { CalendarSummary } from '@shared/planned'

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

/** The sheet's two columns: money coming in, and money going out. */
export const moneyIn: readonly MonthSectionKey[] = ['income']
export const moneyOut: readonly MonthSectionKey[] = [
  'expenses',
  'subscriptions',
  'cards',
  'loans',
  'savings'
]

/**
 * An amount as the sheet shows it: money in +, money out −. Loan rows already carry their sign
 * (+ borrowed, − repaid), and a savings row that took more out than it put in shows +.
 */
export function signedAmount(section: MonthSectionKey, amount: Cents): Cents {
  if (section === 'loans') return amount
  return section === 'income' ? amount : -amount
}

/** What "+" under a section adds. */
export type AddChoice =
  | 'income'
  | 'expense'
  | 'subscription'
  | 'installments'
  | 'card'
  | 'bank_loan'
  | 'borrowed'
  | 'lent'
  | 'goal'

export const sectionAdds: Record<
  MonthSectionKey,
  { label: string; choices: { choice: AddChoice; label: string; description: string }[] }
> = {
  income: {
    label: 'Add income',
    choices: [{ choice: 'income', label: 'Add income', description: '' }]
  },
  expenses: {
    label: 'Add expense',
    choices: [{ choice: 'expense', label: 'Add expense', description: '' }]
  },
  subscriptions: {
    label: 'Add subscription',
    choices: [{ choice: 'subscription', label: 'Add subscription', description: '' }]
  },
  cards: {
    label: 'Add card or installments',
    choices: [
      {
        choice: 'installments',
        label: 'Buy in installments',
        description: 'A purchase on a card, paid off in monthly installments'
      },
      { choice: 'card', label: 'Add a card', description: 'A credit card and its payment dates' }
    ]
  },
  loans: {
    label: 'Add loan',
    choices: [
      {
        choice: 'bank_loan',
        label: 'Bank loan',
        description: 'Paid back in installments, automatically or with a reminder'
      },
      { choice: 'borrowed', label: 'Money borrowed', description: 'From a friend or family' },
      { choice: 'lent', label: 'Money lent', description: 'To a friend or family' }
    ]
  },
  savings: {
    label: 'Add savings goal',
    choices: [{ choice: 'goal', label: 'Add savings goal', description: '' }]
  }
}

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

/**
 * The month's income, expenses and net as the sheet shows them: what's recorded, plus what's
 * still planned for the current and later months. `recorded` is the net of what's recorded.
 */
export function monthNet(summary: CalendarSummary): {
  income: Cents
  expenses: Cents
  net: Cents
  recorded: Cents
  withPlanned: boolean
} {
  const withPlanned =
    summary.projected && (summary.plannedIncome !== 0 || summary.plannedExpenses !== 0)
  const income = summary.income + (summary.projected ? summary.plannedIncome : 0)
  const expenses = summary.expenses + (summary.projected ? summary.plannedExpenses : 0)
  return {
    income,
    expenses,
    net: income - expenses,
    recorded: summary.income - summary.expenses,
    withPlanned
  }
}
