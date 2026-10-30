import { formatDate, type IsoDate } from '@shared/dates'
import type { Schedule } from '@shared/recurrence'
import type { Frequency, RecurringItem } from '@shared/recurring'
import { currentLanguage, t } from '@renderer/lib/i18n'

const ordinalRules = new Intl.PluralRules('en', { type: 'ordinal' })
const ordinalSuffixes: Partial<Record<Intl.LDMLPluralRule, string>> = {
  one: 'st',
  two: 'nd',
  few: 'rd'
}

/** 1st, 2nd, 3rd, 4th, … 21st, 31st; in Croatian 1., 2., 3. */
export const ordinal = (n: number): string =>
  currentLanguage() === 'hr' ? `${n}.` : `${n}${ordinalSuffixes[ordinalRules.select(n)] ?? 'th'}`

/** "Monthly on the 10th", "Every 2 weeks on Monday", "Yearly on 29 February". */
export function describeSchedule(schedule: Schedule, locale: string): string {
  const { frequency, interval, anchorDate } = schedule
  const repeat =
    interval === 1
      ? t(`schedule.${frequency}`)
      : t(`schedule.every.${frequency}`, { count: interval })
  switch (frequency) {
    case 'weekly':
      return t('schedule.onWeekday', {
        repeat,
        weekday: formatDate(anchorDate, locale, { weekday: 'long' })
      })
    case 'monthly': {
      const day = Number(anchorDate.slice(8))
      const shortMonths = day > 28 ? t('recurring.orTheLastDay') : ''
      return t('schedule.onDay', { repeat, day: ordinal(day), shortMonths })
    }
    case 'yearly':
      return t('schedule.onDate', {
        repeat,
        date: formatDate(anchorDate, locale, { day: 'numeric', month: 'long' })
      })
  }
}

/**
 * The anchor for a schedule edited in the form. The schedule starts again from the chosen
 * next date, unless it is unchanged: then the item keeps its anchor, so a payday on the 31st
 * that is next due on 30 November stays on the 31st.
 */
export function anchorFor(
  existing: Pick<RecurringItem, 'frequency' | 'interval' | 'anchorDate' | 'nextDueDate'> | null,
  edited: { frequency: Frequency; interval: number; nextDueDate: IsoDate }
): IsoDate {
  const unchanged =
    existing !== null &&
    existing.frequency === edited.frequency &&
    existing.interval === edited.interval &&
    existing.nextDueDate === edited.nextDueDate
  return unchanged ? existing.anchorDate : edited.nextDueDate
}
