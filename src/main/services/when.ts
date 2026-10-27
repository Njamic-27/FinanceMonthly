import { daysBetween, formatDate, type IsoDate } from '@shared/dates'

/** "today", "tomorrow" or "on Friday 30 Oct", for notification titles. */
export function when(date: IsoDate, today: IsoDate, locale: string): string {
  const days = daysBetween(today, date)
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  return `on ${formatDate(date, locale, { weekday: 'long', day: 'numeric', month: 'short' })}`
}
