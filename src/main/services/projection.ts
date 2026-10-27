import type { Database } from 'better-sqlite3'
import { addMonths, startOfMonth, type IsoDate } from '@shared/dates'
import {
  project,
  projectionQuerySchema,
  type Payoff,
  type ProjectionQuery,
  type ProjectionResult,
  type SavingsPlan
} from '@shared/projection'
import { listInstallmentPlans } from '../db/repositories/installments'
import { listLoans } from '../db/repositories/loans'
import { listSavingsGoals } from '../db/repositories/savings'
import { getSettings } from '../db/repositories/settings'
import {
  getAverageVariableSpending,
  getBalanceAt,
  getBalanceChanges
} from '../db/repositories/stats'
import { openPlannedItems } from './planned'

/**
 * Where the total balance is heading over the next 3 to 24 months: today's balance, every
 * planned payment (the same ones the Calendar shows), transactions already entered for later,
 * and, as Settings say, average everyday spending and the savings plans.
 */
export function buildProjection(
  db: Database,
  input: ProjectionQuery,
  today: IsoDate
): ProjectionResult {
  const { months, granularity } = projectionQuerySchema.parse(input)
  const settings = getSettings(db)
  const end = addMonths(today, months)

  const variableMonthly = getAverageVariableSpending(db, settings.projectionVariableMonths, today)
  const thisMonth = startOfMonth(today)
  const savings: SavingsPlan[] = settings.projectionIncludeSavings
    ? listSavingsGoals(db)
        .filter((g) => !g.isArchived && g.plannedMonthly)
        .map((g) => ({
          goalId: g.id,
          name: g.name,
          plannedMonthly: g.plannedMonthly ?? 0,
          saved: g.saved,
          targetAmount: g.targetAmount,
          depositedThisMonth: g.lastDepositDate !== null && g.lastDepositDate >= thisMonth
        }))
    : []
  const payoffs: Payoff[] = [
    ...listLoans(db).flatMap((loan): Payoff[] =>
      loan.status === 'active' && loan.bank?.next
        ? [
            {
              kind: 'loan_paid_off',
              sourceId: loan.id,
              title: loan.title,
              date: loan.bank.payoffDate
            }
          ]
        : []
    ),
    ...listInstallmentPlans(db).flatMap((plan): Payoff[] =>
      plan.nextDate
        ? [{ kind: 'plan_paid_off', sourceId: plan.id, title: plan.title, date: plan.lastDate }]
        : []
    )
  ]

  const startBalance = getBalanceAt(db, today)
  const projection = project({
    today,
    end,
    granularity,
    weekStart: settings.weekStart,
    startBalance,
    planned: openPlannedItems(db, end, today),
    recorded: getBalanceChanges(db, today, end),
    variableMonthly: settings.projectionIncludeVariable ? variableMonthly : null,
    savings,
    payoffs
  })

  return {
    ...projection,
    months,
    granularity,
    startBalance,
    assumptions: {
      includeVariable: settings.projectionIncludeVariable,
      variableMonths: settings.projectionVariableMonths,
      variableMonthly,
      includeSavings: settings.projectionIncludeSavings,
      savingsMonthly: savings.reduce((sum, s) => sum + s.plannedMonthly, 0)
    }
  }
}
