import { z } from 'zod'
import {
  addDays,
  addMonths,
  eachDay,
  periodsBetween,
  startOfMonth,
  type IsoDate,
  type PeriodKind,
  type WeekStart
} from './dates'
import type { Cents } from './money'
import type { PlannedItem } from './planned'

// Projections (PLAN.md §4): where the total balance is heading, built day by day from today's
// balance and everything known to come, optionally with average everyday spending and the
// monthly savings plans on top. Pure, so it's tested on its own; the main process gathers the
// inputs (src/main/services/projection.ts).

export const projectionHorizons = [3, 6, 12, 24] as const
export type ProjectionHorizon = (typeof projectionHorizons)[number]

export const projectionQuerySchema = z
  .object({
    months: z.union(projectionHorizons.map((m) => z.literal(m))),
    granularity: z.enum(['week', 'month'])
  })
  .strict()
export type ProjectionQuery = z.input<typeof projectionQuerySchema>

/** A savings goal's monthly plan, as far as the projection needs it. */
export interface SavingsPlan {
  goalId: number
  name: string
  plannedMonthly: Cents
  saved: Cents
  targetAmount: Cents
  /** A deposit is already in this month, so the plan resumes next month. */
  depositedThisMonth: boolean
}

/** Something that finishes on a date: a bank loan's last installment, a card purchase's last rate. */
export interface Payoff {
  kind: 'loan_paid_off' | 'plan_paid_off'
  sourceId: number
  title: string
  date: IsoDate
  /** Card purchases: the card they're on. */
  accountId?: number
}

export interface ProjectionInput {
  today: IsoDate
  /** Last day projected, inclusive. */
  end: IsoDate
  granularity: PeriodKind
  weekStart: WeekStart
  /** Total balance of active accounts at the end of today. */
  startBalance: Cents
  /** Planned payments still to settle; overdue ones are counted today. */
  planned: PlannedItem[]
  /** Transactions already entered for days after today: their change to the total balance. */
  recorded: { date: IsoDate; delta: Cents }[]
  /** Average everyday spending per month, spread evenly over the days after today; null for none. */
  variableMonthly: Cents | null
  /** Savings plans to follow; empty to leave savings out. */
  savings: SavingsPlan[]
  payoffs: Payoff[]
}

export interface ProjectionPeriod {
  start: IsoDate
  end: IsoDate
  /** Income planned (and money already entered as coming in). */
  inflow: Cents
  /** Bills, subscriptions, card installments and anything entered for later. */
  fixed: Cents
  /** Bank loan installments. */
  loans: Cents
  /** Money put into savings goals by their monthly plans. */
  savings: Cents
  /** Average everyday spending. */
  variable: Cents
  /** inflow − everything going out. */
  net: Cents
  /** Total balance at the end of the period. */
  balance: Cents
}

export type Milestone =
  | Payoff
  | { kind: 'goal_reached'; sourceId: number; title: string; date: IsoDate }
  | { kind: 'below_zero'; date: IsoDate; balance: Cents }

export interface Projection {
  periods: ProjectionPeriod[]
  /** By date. */
  milestones: Milestone[]
  lowest: { date: IsoDate; balance: Cents }
  endBalance: Cents
}

/** Days in an average month (365.25 / 12), for spreading monthly spending over days. */
const DAYS_PER_MONTH = 30.4375

interface DayFlows {
  inflow: number
  fixed: number
  loans: number
  savings: number
  variable: number
}

const emptyDay = (): DayFlows => ({ inflow: 0, fixed: 0, loans: 0, savings: 0, variable: 0 })

/** When each savings plan puts money in: this month (today) unless done, then each 1st. */
function savingsDeposits(
  plans: SavingsPlan[],
  today: IsoDate,
  end: IsoDate
): {
  deposits: { date: IsoDate; amount: Cents }[]
  reached: Milestone[]
} {
  const deposits: { date: IsoDate; amount: Cents }[] = []
  const reached: Milestone[] = []
  for (const plan of plans) {
    let saved = plan.saved
    if (saved >= plan.targetAmount || plan.plannedMonthly <= 0) continue
    let date = plan.depositedThisMonth ? addMonths(startOfMonth(today), 1) : today
    while (date <= end && saved < plan.targetAmount) {
      // The last deposit only tops the goal up to its target.
      const amount = Math.min(plan.plannedMonthly, plan.targetAmount - saved)
      deposits.push({ date, amount })
      saved += amount
      if (saved >= plan.targetAmount) {
        reached.push({ kind: 'goal_reached', sourceId: plan.goalId, title: plan.name, date })
      }
      date = addMonths(startOfMonth(date), 1)
    }
  }
  return { deposits, reached }
}

/**
 * Projects the total balance from today to `end`. Each day adds what's planned or entered for
 * it, savings deposits and (from tomorrow) a day's share of average spending; periods add the
 * days up, and the balance is carried from day to day.
 */
export function project(input: ProjectionInput): Projection {
  const { today, end } = input
  const days = new Map<IsoDate, DayFlows>()
  const at = (date: IsoDate): DayFlows => {
    // Anything already overdue still has to happen: count it today.
    const day = date < today ? today : date
    let flows = days.get(day)
    if (!flows) days.set(day, (flows = emptyDay()))
    return flows
  }

  for (const item of input.planned) {
    if (item.date > end) continue
    const flows = at(item.date)
    if (item.group === 'income') flows.inflow += item.amount
    else if (item.group === 'loan') flows.loans += item.amount
    else if (item.group === 'savings') flows.savings += item.amount
    else flows.fixed += item.amount
  }
  for (const { date, delta } of input.recorded) {
    if (date <= today || date > end) continue
    if (delta >= 0) at(date).inflow += delta
    else at(date).fixed += -delta
  }
  const { deposits, reached } = savingsDeposits(input.savings, today, end)
  for (const { date, amount } of deposits) at(date).savings += amount

  // Average spending, a day's share each day after today, in whole cents with no drift.
  if (input.variableMonthly && input.variableMonthly > 0 && end > today) {
    let spread = 0
    eachDay(addDays(today, 1), end).forEach((date, i) => {
      const upTo = Math.round(((input.variableMonthly as number) * (i + 1)) / DAYS_PER_MONTH)
      at(date).variable += upTo - spread
      spread = upTo
    })
  }

  // Walk the days in order, carrying the balance.
  let balance = input.startBalance
  let lowest = { date: today, balance }
  let belowZero: Milestone | null =
    balance < 0 ? { kind: 'below_zero', date: today, balance } : null
  const balanceAt = new Map<IsoDate, number>()
  for (const date of eachDay(today, end)) {
    const flows = days.get(date)
    if (flows) {
      balance += flows.inflow - flows.fixed - flows.loans - flows.savings - flows.variable
    }
    balanceAt.set(date, balance)
    if (balance < lowest.balance) lowest = { date, balance }
    if (!belowZero && balance < 0) belowZero = { kind: 'below_zero', date, balance }
  }

  const periods = periodsBetween(input.granularity, today, end, input.weekStart).map(
    (period): ProjectionPeriod => {
      const start = period.start < today ? today : period.start
      const stop = period.end > end ? end : period.end
      const sum = emptyDay()
      for (const date of eachDay(start, stop)) {
        const flows = days.get(date)
        if (!flows) continue
        sum.inflow += flows.inflow
        sum.fixed += flows.fixed
        sum.loans += flows.loans
        sum.savings += flows.savings
        sum.variable += flows.variable
      }
      return {
        start,
        end: stop,
        ...sum,
        net: sum.inflow - sum.fixed - sum.loans - sum.savings - sum.variable,
        balance: balanceAt.get(stop) ?? balance
      }
    }
  )

  const milestones: Milestone[] = [
    ...input.payoffs.filter((p) => p.date > today && p.date <= end),
    ...reached,
    ...(belowZero ? [belowZero] : [])
  ].sort((a, b) => a.date.localeCompare(b.date))

  return { periods, milestones, lowest, endBalance: balance }
}

/** A projection with the assumptions it was made on, for the Projections screen. */
export interface ProjectionResult extends Projection {
  months: ProjectionHorizon
  granularity: PeriodKind
  /** Total balance today, where the projection starts. */
  startBalance: Cents
  assumptions: {
    /** Average everyday spending was added, and how much a month (null: no data yet). */
    includeVariable: boolean
    variableMonths: number
    variableMonthly: Cents | null
    /** Savings plans were followed, and what they put in a month at most. */
    includeSavings: boolean
    savingsMonthly: Cents
  }
}
