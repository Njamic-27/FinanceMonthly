import { formatDate, type IsoDate } from '@shared/dates'

/**
 * The month a transaction counts in, when that isn't the month it happened: a card purchase
 * counts when its bill is due (PLAN.md step 42). "November", or "January 2027" across a year's
 * end; null when it counts in its own month.
 */
export function countsInMonth(date: IsoDate, countsOn: IsoDate, locale: string): string | null {
  if (countsOn.slice(0, 7) === date.slice(0, 7)) return null
  return formatDate(countsOn, locale, {
    month: 'long',
    ...(countsOn.slice(0, 4) !== date.slice(0, 4) && { year: 'numeric' })
  })
}
