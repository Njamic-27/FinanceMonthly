import type { Account } from '@shared/accounts'
import type { MoneyOutGroup, MoneyOutLine } from '@shared/month'
import { t } from '@renderer/lib/i18n'

// Naming money-out lines (PLAN.md step 50).

export const moneyOutGroupLabel = (group: Exclude<MoneyOutGroup, 'card'>): string =>
  t(`group.${group}`)

/** A line's name: its group, or "Credit card (Mastercard)". */
export function lineLabel(line: MoneyOutLine, accounts: Account[]): string {
  if (line.group !== 'card') return moneyOutGroupLabel(line.group)
  const card = accounts.find((a) => a.id === line.cardId)?.name ?? t('common.card')
  return t('month.creditCardLine', { card })
}
