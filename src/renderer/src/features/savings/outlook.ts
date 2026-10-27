import { formatDate, type IsoDate } from '@shared/dates'
import { goalEta, monthlyNeeded, onTrack, type SavingsGoal } from '@shared/savings'
import type { CurrencyTools } from '@renderer/hooks/useCurrency'

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
  if (left <= 0) return 'Goal reached.'

  const eta = goalEta(goal, today)
  const needed = monthlyNeeded(goal, today)
  const by = goal.targetDate && month(goal.targetDate)
  if (eta && goal.plannedMonthly) {
    const plan = `At ${money.format(goal.plannedMonthly)} a month you’ll reach it in ${month(eta)}`
    if (!goal.targetDate || needed === null) return `${plan}.`
    return onTrack(goal, today)
      ? `${plan}, in time for ${by}.`
      : `${plan}. To make it by ${by}, put in ${money.format(needed)} a month.`
  }
  if (needed !== null) return `Put in ${money.format(needed)} a month to reach it by ${by}.`
  return `${money.format(left)} to go.`
}
