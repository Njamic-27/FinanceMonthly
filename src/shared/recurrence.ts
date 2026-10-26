import { addDays, addMonths, daysBetween, type IsoDate } from './dates'
import type { RecurringItem } from './recurring'

/** The part of a recurring item that decides when it falls due. */
export type Schedule = Pick<RecurringItem, 'frequency' | 'interval' | 'anchorDate' | 'endDate'>

/**
 * Occurrence `n` (0 = the anchor). Always counted from the anchor, never from the previous
 * occurrence, so a schedule on the 31st comes back to the 31st after a short month
 * (31 Jan → 28 Feb → 31 Mar) and 29 February falls on the 28th in other years.
 */
function nth(schedule: Schedule, n: number): IsoDate {
  const { anchorDate, interval } = schedule
  switch (schedule.frequency) {
    case 'weekly':
      return addDays(anchorDate, 7 * interval * n)
    case 'monthly':
      return addMonths(anchorDate, interval * n)
    case 'yearly':
      return addMonths(anchorDate, 12 * interval * n)
  }
}

const monthIndex = (date: IsoDate): number =>
  Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7))

/** An index whose occurrence is on or before `date` (0 before the anchor), so scans start near it. */
function indexBefore(schedule: Schedule, date: IsoDate): number {
  if (date <= schedule.anchorDate) return 0
  if (schedule.frequency === 'weekly') {
    return Math.floor(daysBetween(schedule.anchorDate, date) / (7 * schedule.interval))
  }
  const step = schedule.frequency === 'monthly' ? schedule.interval : 12 * schedule.interval
  // One step back: in the month of `date` itself the occurrence may fall after it.
  const months = monthIndex(date) - monthIndex(schedule.anchorDate)
  return Math.max(0, Math.floor(months / step) - 1)
}

function check(schedule: Schedule): void {
  if (!Number.isInteger(schedule.interval) || schedule.interval < 1) {
    throw new Error(`Interval must be a whole number of at least 1: ${schedule.interval}`)
  }
}

/**
 * Every date the schedule falls due from `from` to `to` (both inclusive), oldest first.
 * Starts at the anchor and stops after `endDate`. Ignores `nextDueDate` and `isActive`:
 * callers start at `nextDueDate` for what is still to post and skip paused items.
 */
export function occurrences(schedule: Schedule, from: IsoDate, to: IsoDate): IsoDate[] {
  check(schedule)
  const last = schedule.endDate !== null && schedule.endDate < to ? schedule.endDate : to
  const dates: IsoDate[] = []
  for (let n = indexBefore(schedule, from); ; n++) {
    const date = nth(schedule, n)
    if (date > last) return dates
    if (date >= from) dates.push(date)
  }
}

/** The first date the schedule falls due after `after`, or null once it has ended. */
export function nextOccurrence(schedule: Schedule, after: IsoDate): IsoDate | null {
  check(schedule)
  for (let n = indexBefore(schedule, after); ; n++) {
    const date = nth(schedule, n)
    if (schedule.endDate !== null && date > schedule.endDate) return null
    if (date > after) return date
  }
}
