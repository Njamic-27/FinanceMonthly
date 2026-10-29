import type { Account } from '@shared/accounts'
import type { MoneyOutGroup, MoneyOutLine } from '@shared/month'

// Naming money-out lines (PLAN.md step 50).

export const moneyOutGroupLabels: Record<Exclude<MoneyOutGroup, 'card'>, string> = {
  subscriptions: 'Subscriptions',
  bills: 'Bills',
  everyday: 'Everyday',
  loans: 'Loans',
  savings: 'Savings'
}

/** A line's name: its group, or "Credit card (Mastercard)". */
export function lineLabel(line: MoneyOutLine, accounts: Account[]): string {
  if (line.group !== 'card') return moneyOutGroupLabels[line.group]
  return `Credit card (${accounts.find((a) => a.id === line.cardId)?.name ?? 'card'})`
}
