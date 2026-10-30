import { t } from '@renderer/lib/i18n'

export type FlowPartKey = 'inflow' | 'fixed' | 'variable' | 'loans' | 'savings'

/** The parts of a period's money, in stacking order, with their money colour. */
export const flowParts = (): {
  key: FlowPartKey
  label: string
  color: string
  opacity: number
}[] => [
  { key: 'inflow', label: t('projections.moneyIn'), color: 'var(--income)', opacity: 1 },
  { key: 'fixed', label: t('projections.billsAndPlanned'), color: 'var(--expense)', opacity: 1 },
  {
    key: 'variable',
    label: t('projections.everydaySpending'),
    color: 'var(--expense)',
    opacity: 0.45
  },
  { key: 'loans', label: t('projections.loanInstallments'), color: 'var(--loan)', opacity: 1 },
  { key: 'savings', label: t('projections.intoSavings'), color: 'var(--savings)', opacity: 1 }
]
