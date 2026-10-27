import { endOfMonth, parseIsoDate, type DateRange, type PeriodKind } from '@shared/dates'
import { projectionHorizons, type ProjectionHorizon } from '@shared/projection'

/**
 * "Nov 2026" for a whole month, "27 – 31 Oct" for one cut short by today or the horizon, and
 * "2 – 8 Nov" for a week.
 */
export function periodLabel(period: DateRange, kind: PeriodKind, locale: string): string {
  const wholeMonth =
    kind === 'month' && period.start.endsWith('-01') && period.end === endOfMonth(period.start)
  if (wholeMonth) {
    return new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' }).format(
      parseIsoDate(period.start)
    )
  }
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).formatRange(
    parseIsoDate(period.start),
    parseIsoDate(period.end)
  )
}

/** A short axis tick: "Nov" for a month ("Jan 27" in January), "2 Nov" for a week. */
export function periodTick(period: DateRange, kind: PeriodKind, locale: string): string {
  const start = parseIsoDate(period.start)
  if (kind === 'week') {
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(start)
  }
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    ...(start.getMonth() === 0 && { year: '2-digit' })
  }).format(start)
}

/** Reads `?months=3|6|12|24&by=week|month`; anything else falls back to 12 months by month. */
export function readProjectionParams(params: URLSearchParams): {
  months: ProjectionHorizon
  granularity: PeriodKind
} {
  const months = Number(params.get('months'))
  return {
    months: (projectionHorizons as readonly number[]).includes(months)
      ? (months as ProjectionHorizon)
      : 12,
    granularity: params.get('by') === 'week' ? 'week' : 'month'
  }
}
