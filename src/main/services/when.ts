import { daysBetween, formatDate, type IsoDate } from '@shared/dates'
import { t } from '@shared/i18n'

/** "today", "tomorrow" or "on Friday 30 Oct", for notification titles. */
export function when(date: IsoDate, today: IsoDate, locale: string): string {
  const days = daysBetween(today, date)
  if (days === 0) return t('reminder.today')
  if (days === 1) return t('reminder.tomorrow')
  return t('reminder.on', {
    date: formatDate(date, locale, { weekday: 'long', day: 'numeric', month: 'short' })
  })
}
