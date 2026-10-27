import { z } from 'zod'
import { addMonths, daysBetween, isIsoDate, startOfMonth, type IsoDate } from './dates'
import { MAX_CENTS, type Cents } from './money'
import { paletteColors, type PaletteColor } from './palette'

/**
 * A savings goal: an envelope you put money into from your accounts and take it back out of
 * (PLAN.md §2). What's in it is the starting amount plus deposits minus withdrawals.
 */
export interface SavingsGoal {
  id: number
  name: string
  targetAmount: Cents
  targetDate: IsoDate | null
  /** Already saved before using the app. */
  startingAmount: Cents
  /** What you plan to put in each month; drives the estimated date. */
  plannedMonthly: Cents | null
  color: PaletteColor
  isArchived: boolean
  sortOrder: number
  /** startingAmount + deposits − withdrawals. */
  saved: Cents
  /** Deposits and withdrawals recorded for it. */
  movementCount: number
  /** The latest deposit's date: one this month means this month's saving is done. */
  lastDepositDate: IsoDate | null
  createdAt: string
}

export const savingsGoalIdSchema = z.number().int().positive()

const amount = z
  .number()
  .int()
  .positive('Enter an amount above zero')
  .max(MAX_CENTS, 'That amount is too large')
const isoDate = z.string().refine(isIsoDate, 'Choose a date')

export const savingsGoalInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Give the goal a name')
      .max(40, 'Keep the name to 40 characters or fewer'),
    targetAmount: amount,
    targetDate: isoDate.nullable(),
    startingAmount: z
      .number()
      .int()
      .min(0, 'Enter what you already have, or 0')
      .max(MAX_CENTS, 'That amount is too large'),
    plannedMonthly: amount.nullable(),
    color: z.enum(paletteColors)
  })
  .strict()
export type SavingsGoalInput = z.input<typeof savingsGoalInputSchema>

export const movementTypes = ['deposit', 'withdrawal'] as const
export type MovementType = (typeof movementTypes)[number]

/** Putting money into a goal from an account, or taking it back out into one. */
export const savingsMovementInputSchema = z
  .object({
    goalId: savingsGoalIdSchema,
    type: z.enum(movementTypes),
    amount,
    accountId: z.number({ error: 'Choose an account' }).int().positive('Choose an account'),
    date: isoDate,
    note: z
      .string()
      .trim()
      .max(500, 'Keep the note to 500 characters or fewer')
      .transform((note) => note || null)
      .nullable()
  })
  .strict()
export type SavingsMovementInput = z.input<typeof savingsMovementInputSchema>

/** How far along a goal is: 0 to 1 (more than 1 past the target). */
export const goalShare = (goal: Pick<SavingsGoal, 'saved' | 'targetAmount'>): number =>
  goal.targetAmount > 0 ? Math.max(0, goal.saved) / goal.targetAmount : 0

/** 1 when something was already put in this month, so saving resumes next month; else 0. */
const doneThisMonth = (goal: { lastDepositDate?: IsoDate | null }, today: IsoDate): number =>
  goal.lastDepositDate && goal.lastDepositDate >= startOfMonth(today) ? 1 : 0

/**
 * When the goal is reached if the planned monthly amount goes in each month, starting this
 * month (or next, if this month's deposit is in): the first of the month the last one lands
 * in. Null without a plan; `today` if reached.
 */
export function goalEta(
  goal: Pick<SavingsGoal, 'saved' | 'targetAmount' | 'plannedMonthly'> &
    Partial<Pick<SavingsGoal, 'lastDepositDate'>>,
  today: IsoDate
): IsoDate | null {
  const left = goal.targetAmount - goal.saved
  if (left <= 0) return today
  if (!goal.plannedMonthly) return null
  const deposits = Math.ceil(left / goal.plannedMonthly)
  return addMonths(startOfMonth(today), doneThisMonth(goal, today) + deposits - 1)
}

/**
 * What to put in each month to reach the target by its date, counting the target's month and
 * this one (unless this month's deposit is in). Null without a target date; 0 once it's
 * reached; everything that's left when no month remains.
 */
export function monthlyNeeded(
  goal: Pick<SavingsGoal, 'saved' | 'targetAmount' | 'targetDate'> &
    Partial<Pick<SavingsGoal, 'lastDepositDate'>>,
  today: IsoDate
): Cents | null {
  if (!goal.targetDate) return null
  const left = goal.targetAmount - goal.saved
  if (left <= 0) return 0
  const months =
    (Number(goal.targetDate.slice(0, 4)) - Number(today.slice(0, 4))) * 12 +
    (Number(goal.targetDate.slice(5, 7)) - Number(today.slice(5, 7))) +
    1 -
    doneThisMonth(goal, today)
  return months <= 1 ? left : Math.ceil(left / months)
}

/** Whether the planned monthly amount reaches the goal by its target date. */
export function onTrack(
  goal: Pick<SavingsGoal, 'saved' | 'targetAmount' | 'plannedMonthly' | 'targetDate'> &
    Partial<Pick<SavingsGoal, 'lastDepositDate'>>,
  today: IsoDate
): boolean | null {
  if (!goal.targetDate) return null
  const eta = goalEta(goal, today)
  if (eta === null) return false
  return daysBetween(eta, goal.targetDate) >= 0
}
