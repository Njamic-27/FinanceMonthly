import {
  addDays,
  daysBetween,
  formatDate,
  isIsoDate,
  parseIsoDate,
  periodContaining,
  shiftPeriod,
  type DateRange,
  type IsoDate,
  type PeriodKind,
  type WeekStart
} from '@shared/dates'

export interface OverviewPeriod {
  kind: PeriodKind
  range: DateRange
  /** The period contains today, so it's still going on. */
  isCurrent: boolean
}

function periodAt(
  kind: PeriodKind,
  date: IsoDate,
  today: IsoDate,
  weekStart: WeekStart
): OverviewPeriod {
  const current = periodContaining(kind, today, weekStart)
  // Overview looks back, not ahead: anything after the current period shows the current one.
  if (date > current.end) return { kind, range: current, isCurrent: true }
  const range = periodContaining(kind, date, weekStart)
  return { kind, range, isCurrent: range.start === current.start }
}

/**
 * Reads `?view=week|month&date=YYYY-MM-DD` (any day in the period; other screens link here
 * with it). Missing or malformed parts fall back to this month.
 */
export function readOverviewPeriod(
  params: URLSearchParams,
  today: IsoDate,
  weekStart: WeekStart
): OverviewPeriod {
  const kind: PeriodKind = params.get('view') === 'week' ? 'week' : 'month'
  const date = params.get('date')
  return periodAt(kind, date && isIsoDate(date) ? date : today, today, weekStart)
}

export function overviewParams(kind: PeriodKind, date: IsoDate): URLSearchParams {
  return new URLSearchParams({ view: kind, date })
}

/** The period `n` steps away, no later than the current one. */
export function stepPeriod(
  period: OverviewPeriod,
  n: number,
  today: IsoDate,
  weekStart: WeekStart
): OverviewPeriod {
  const { start } = shiftPeriod(period.kind, period.range.start, n, weekStart)
  return periodAt(period.kind, start, today, weekStart)
}

/**
 * Switching between week and month keeps you near the same days: today if the period
 * contains it, otherwise the period's first day.
 */
export function switchKind(
  period: OverviewPeriod,
  kind: PeriodKind,
  today: IsoDate,
  weekStart: WeekStart
): OverviewPeriod {
  return periodAt(kind, period.isCurrent ? today : period.range.start, today, weekStart)
}

/**
 * What a period is compared with: the previous week or month. A period still going on is
 * compared with the same number of days at the start of the previous one, so half a month
 * isn't measured against a whole one.
 */
export function comparisonFor(
  period: OverviewPeriod,
  today: IsoDate,
  weekStart: WeekStart
): { range: DateRange; partial: boolean } {
  const previous = shiftPeriod(period.kind, period.range.start, -1, weekStart)
  if (!period.isCurrent) return { range: previous, partial: false }
  const sameDay = addDays(previous.start, daysBetween(period.range.start, today))
  return sameDay < previous.end
    ? { range: { start: previous.start, end: sameDay }, partial: true }
    : { range: previous, partial: false }
}

/**
 * How the comparison reads after "more than …": "1–26 Sep" for part of a period,
 * "September" (with the year if it differs) for a whole month, "the week before" for a week.
 */
export function comparisonLabel(
  period: OverviewPeriod,
  comparison: { range: DateRange; partial: boolean },
  locale: string
): string {
  const { start, end } = comparison.range
  if (comparison.partial) {
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).formatRange(
      parseIsoDate(start),
      parseIsoDate(end)
    )
  }
  if (period.kind === 'week') return 'the week before'
  const sameYear = start.slice(0, 4) === period.range.start.slice(0, 4)
  return formatDate(start, locale, { month: 'long', ...(!sameYear && { year: 'numeric' }) })
}

/** Change from `previous` to `current` as a fraction (0.25 = 25% more); null if `previous` is 0. */
export function relativeChange(current: number, previous: number): number | null {
  return previous === 0 ? null : (current - previous) / previous
}
