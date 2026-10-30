import type { RecurringKind } from '@shared/recurring'
import { t } from '@renderer/lib/i18n'

/** What to call a recurring item of each kind in a button or title. */
export const kindText = (
  kind: RecurringKind,
  what: 'add' | 'new' | 'edit' | 'delete' | 'placeholder'
): string => t(`recurring.${what}.${kind}`)

/** "On the day", "2 days before", "A week before". */
export function reminderLabel(daysBefore: number): string {
  if (daysBefore === 0) return t('recurring.reminder.onDay')
  if (daysBefore === 7) return t('recurring.reminder.weekBefore')
  return t('recurring.reminder.daysBefore', { count: daysBefore })
}
