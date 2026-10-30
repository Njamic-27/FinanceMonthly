import { formatDate, type IsoDate } from '@shared/dates'
import { goalEta, monthlyNeeded, onTrack, type SavingsGoal } from '@shared/savings'
import type { CurrencyTools } from '@renderer/hooks/useCurrency'
import { t } from '@renderer/lib/i18n'

type Goal = Pick<SavingsGoal, 'saved' | 'targetAmount' | 'targetDate' | 'plannedMonthly'> &
  Partial<Pick<SavingsGoal, 'lastDepositDate'>>

/**
 * Where a goal is heading, in one sentence: when the monthly plan reaches it, whether that
 * makes the target date, or what it takes to.
 */
export function goalOutlook(goal: Goal, today: IsoDate, money: CurrencyTools): string {
  const month = (date: IsoDate): string =>
    formatDate(date, money.locale, { month: 'long', year: 'numeric' })
  const left = goal.targetAmount - goal.saved
  if (left <= 0) return t('savings.goalReached')

  const eta = goalEta(goal, today)
  const needed = monthlyNeeded(goal, today)
  const by = goal.targetDate && month(goal.targetDate)
  if (eta && goal.plannedMonthly) {
    const plan = t('savings.planReach', {
      amount: money.format(goal.plannedMonthly),
      month: month(eta)
    })
    if (!goal.targetDate || needed === null) return t('savings.planOnly', { plan })
    return onTrack(goal, today)
      ? t('savings.planInTime', { plan, by: by ?? '' })
      : t('savings.planLate', { plan, by: by ?? '', amount: money.format(needed) })
  }
  if (needed !== null) {
    return t('savings.putInToReach', { amount: money.format(needed), by: by ?? '' })
  }
  return t('savings.toGo', { amount: money.format(left) })
}
