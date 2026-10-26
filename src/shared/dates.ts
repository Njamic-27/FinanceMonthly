import {
  addDays as addDaysFns,
  addMonths as addMonthsFns,
  addWeeks,
  differenceInCalendarDays,
  endOfMonth as endOfMonthFns,
  endOfWeek as endOfWeekFns,
  getDaysInMonth,
  isValid,
  startOfMonth as startOfMonthFns,
  startOfWeek as startOfWeekFns,
  type Day
} from 'date-fns'

/**
 * Calendar dates travel through the app as 'YYYY-MM-DD' strings, the same format the
 * database stores. They compare correctly as strings and have no time zone, so a date
 * never shifts by a day. Date objects are only used inside this module, at local midnight.
 */
export type IsoDate = string

/** 0 = Sunday, 1 = Monday, … 6 = Saturday (same as Settings.weekStart). */
export type WeekStart = number

export type PeriodKind = 'week' | 'month'

export interface DateRange {
  /** First day, inclusive. */
  start: IsoDate
  /** Last day, inclusive. */
  end: IsoDate
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

export function isIsoDate(value: string): boolean {
  const m = ISO_DATE.exec(value)
  if (!m) return false
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return isValid(date) && toIsoDate(date) === value
}

export function parseIsoDate(value: IsoDate): Date {
  const m = ISO_DATE.exec(value)
  if (!m) throw new Error(`Not a YYYY-MM-DD date: ${value}`)
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  if (toIsoDate(date) !== value) throw new Error(`Not a real calendar date: ${value}`)
  return date
}

export function toIsoDate(date: Date): IsoDate {
  const y = String(date.getFullYear()).padStart(4, '0')
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function today(now: Date = new Date()): IsoDate {
  return toIsoDate(now)
}

const map =
  (fn: (date: Date, n: number) => Date) =>
  (value: IsoDate, n: number): IsoDate =>
    toIsoDate(fn(parseIsoDate(value), n))

export const addDays = map(addDaysFns)
/** Clamps to the end of the month: Jan 31 + 1 month = Feb 28 (or 29). */
export const addMonths = map(addMonthsFns)

export function daysBetween(from: IsoDate, to: IsoDate): number {
  return differenceInCalendarDays(parseIsoDate(to), parseIsoDate(from))
}

export function daysInMonth(value: IsoDate): number {
  return getDaysInMonth(parseIsoDate(value))
}

export function startOfMonth(value: IsoDate): IsoDate {
  return toIsoDate(startOfMonthFns(parseIsoDate(value)))
}

export function endOfMonth(value: IsoDate): IsoDate {
  return toIsoDate(endOfMonthFns(parseIsoDate(value)))
}

/** Day `day` of the month containing `value`, or the month's last day if it is shorter (31 → 30 Nov). */
export function dayOfMonth(value: IsoDate, day: number): IsoDate {
  const start = startOfMonth(value)
  return `${start.slice(0, 8)}${String(Math.min(day, daysInMonth(start))).padStart(2, '0')}`
}

/**
 * Where a monthly schedule on `day` (1–31) stands on `today`:
 * - `nextDueDate`: the first payday on or after today, moved to the month's last day in shorter
 *   months (payday 31 → 30 November);
 * - `anchorDate`: the latest date on or before it that falls exactly on `day`, so the schedule
 *   keeps its real day of the month (31 October, not 30 November).
 */
export function monthlySchedule(
  day: number,
  today: IsoDate
): { anchorDate: IsoDate; nextDueDate: IsoDate } {
  let nextDueDate = dayOfMonth(today, day)
  if (nextDueDate < today) nextDueDate = dayOfMonth(addMonths(startOfMonth(today), 1), day)
  let anchorDate = nextDueDate
  while (Number(anchorDate.slice(8)) !== day) {
    anchorDate = dayOfMonth(addMonths(startOfMonth(anchorDate), -1), day)
  }
  return { anchorDate, nextDueDate }
}

export function startOfWeek(value: IsoDate, weekStart: WeekStart): IsoDate {
  return toIsoDate(startOfWeekFns(parseIsoDate(value), { weekStartsOn: weekStart as Day }))
}

export function endOfWeek(value: IsoDate, weekStart: WeekStart): IsoDate {
  return toIsoDate(endOfWeekFns(parseIsoDate(value), { weekStartsOn: weekStart as Day }))
}

/** The week or month that contains `value`. */
export function periodContaining(
  kind: PeriodKind,
  value: IsoDate,
  weekStart: WeekStart
): DateRange {
  return kind === 'week'
    ? { start: startOfWeek(value, weekStart), end: endOfWeek(value, weekStart) }
    : { start: startOfMonth(value), end: endOfMonth(value) }
}

/** The period `n` steps before (negative) or after (positive) the one containing `value`. */
export function shiftPeriod(
  kind: PeriodKind,
  value: IsoDate,
  n: number,
  weekStart: WeekStart
): DateRange {
  const date = parseIsoDate(value)
  const shifted = kind === 'week' ? addWeeks(date, n) : addMonthsFns(startOfMonthFns(date), n)
  return periodContaining(kind, toIsoDate(shifted), weekStart)
}

/** Every week or month that overlaps [from, to], in order. */
export function periodsBetween(
  kind: PeriodKind,
  from: IsoDate,
  to: IsoDate,
  weekStart: WeekStart
): DateRange[] {
  const periods: DateRange[] = []
  let period = periodContaining(kind, from, weekStart)
  while (period.start <= to) {
    periods.push(period)
    period = periodContaining(kind, addDays(period.end, 1), weekStart)
  }
  return periods
}

/** Every day from `from` to `to`, inclusive. */
export function eachDay(from: IsoDate, to: IsoDate): IsoDate[] {
  const days: IsoDate[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d)
  return days
}

export function formatDate(
  value: IsoDate,
  locale: string,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }
): string {
  return new Intl.DateTimeFormat(locale, options).format(parseIsoDate(value))
}

/** "October 2026" or "19 – 25 Oct 2026". */
export function formatPeriod(kind: PeriodKind, range: DateRange, locale: string): string {
  if (kind === 'month') {
    return formatDate(range.start, locale, { month: 'long', year: 'numeric' })
  }
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).formatRange(parseIsoDate(range.start), parseIsoDate(range.end))
}
