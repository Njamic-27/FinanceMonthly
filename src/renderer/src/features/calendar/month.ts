import {
  addDays,
  addMonths,
  formatDate,
  isIsoDate,
  startOfMonth,
  startOfWeek,
  type IsoDate,
  type WeekStart
} from '@shared/dates'
import { CALENDAR_MONTHS_AHEAD } from '@shared/planned'

/** The first day of the latest month the Calendar shows: 24 months after this one. */
export function lastCalendarMonth(today: IsoDate): IsoDate {
  return startOfMonth(addMonths(startOfMonth(today), CALENDAR_MONTHS_AHEAD))
}

/**
 * The months the month picker offers: from the month your data starts (the first transaction
 * or account opening, or this month if that's later) to the last month the Calendar shows.
 */
export function pickableMonths(
  firstDate: IsoDate | null,
  today: IsoDate
): { first: IsoDate; last: IsoDate } {
  const start = firstDate && firstDate < today ? firstDate : today
  return { first: startOfMonth(start), last: lastCalendarMonth(today) }
}

const clamp = (month: IsoDate, today: IsoDate): IsoDate => {
  const last = lastCalendarMonth(today)
  return month > last ? last : month
}

/**
 * Reads `?month=YYYY-MM` as the first day of that month. Missing or malformed values show
 * this month; months past the last one show the last one.
 */
export function readCalendarMonth(params: URLSearchParams, today: IsoDate): IsoDate {
  const value = params.get('month')
  const first = `${value}-01`
  return clamp(value && isIsoDate(first) ? first : startOfMonth(today), today)
}

/**
 * Reads `?day=YYYY-MM-DD`, the day whose panel is open: one in `month`, or in the month before
 * or after (the grid's first and last weeks show some of their days).
 */
export function readCalendarDay(params: URLSearchParams, month: IsoDate): IsoDate | null {
  const day = params.get('day')
  if (!day || !isIsoDate(day)) return null
  const its = startOfMonth(day)
  return its === month || its === addMonths(month, -1) || its === addMonths(month, 1) ? day : null
}

/** A month, and optionally the day open in it. */
export function calendarParams(month: IsoDate, day?: IsoDate): URLSearchParams {
  return new URLSearchParams({ month: month.slice(0, 7), ...(day && { day }) })
}

/** The month `n` months away, no later than the last one. */
export function stepMonth(month: IsoDate, n: number, today: IsoDate): IsoDate {
  return clamp(addMonths(startOfMonth(month), n), today)
}

/** Short weekday names in grid order: "Mon", "Tue", … or "Sun", "Mon", … */
export function weekdayLabels(weekStart: WeekStart, locale: string): string[] {
  const first = startOfWeek('2026-01-07', weekStart)
  return Array.from({ length: 7 }, (_, i) =>
    formatDate(addDays(first, i), locale, { weekday: 'short' })
  )
}
