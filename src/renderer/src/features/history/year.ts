import {
  addDays,
  daysBetween,
  parseIsoDate,
  type DateRange,
  type IsoDate,
  type PeriodKind
} from '@shared/dates'

export interface HistoryState {
  year: number
  /** Tiles for each month, or for each week. */
  view: PeriodKind
}

/** Reads `?year=2026&view=month|week`; anything missing, malformed or ahead goes to this year. */
export function readHistory(params: URLSearchParams, today: IsoDate): HistoryState {
  const current = Number(today.slice(0, 4))
  const year = Number(params.get('year'))
  return {
    year: Number.isInteger(year) && year >= 1900 && year <= current ? year : current,
    view: params.get('view') === 'week' ? 'week' : 'month'
  }
}

export function historyParams(state: HistoryState): URLSearchParams {
  return new URLSearchParams({ year: String(state.year), view: state.view })
}

export function yearRange(year: number): DateRange {
  return { start: `${year}-01-01`, end: `${year}-12-31` }
}

/**
 * The previous year; this year is compared with the same days of the last one, so ten
 * months aren't measured against twelve.
 */
export function yearComparison(
  year: number,
  today: IsoDate
): { range: DateRange; partial: boolean } {
  const previous = yearRange(year - 1)
  if (String(year) !== today.slice(0, 4)) return { range: previous, partial: false }
  const sameDay = addDays(previous.start, daysBetween(yearRange(year).start, today))
  return sameDay < previous.end
    ? { range: { start: previous.start, end: sameDay }, partial: true }
    : { range: previous, partial: false }
}

/** "1 Jan – 26 Oct 2025" for part of a year, "2025" for all of it. */
export function yearComparisonLabel(
  comparison: { range: DateRange; partial: boolean },
  locale: string
): string {
  const { start, end } = comparison.range
  if (!comparison.partial) return start.slice(0, 4)
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).formatRange(parseIsoDate(start), parseIsoDate(end))
}

/** Heat steps after "nothing": 1 is the lightest, HEAT_STEPS the strongest. */
export const HEAT_STEPS = 4

/**
 * 0 for nothing, then 1 to HEAT_STEPS spread between the lowest and highest values shown,
 * so steady months still show which ones cost more. All alike sit in the middle.
 */
export function heatLevel(value: number, min: number, max: number): number {
  if (value <= 0) return 0
  if (max <= min) return Math.ceil(HEAT_STEPS / 2)
  const position = (value - min) / (max - min)
  return Math.min(HEAT_STEPS, 1 + Math.floor(position * HEAT_STEPS))
}
