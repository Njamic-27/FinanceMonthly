import type { RecurringKind } from '@shared/recurring'

export const kindLabels: Record<RecurringKind, { noun: string; placeholder: string }> = {
  income: { noun: 'recurring income', placeholder: 'e.g. Salary' },
  expense: { noun: 'recurring expense', placeholder: 'e.g. Rent' },
  subscription: { noun: 'subscription', placeholder: 'e.g. Netflix' }
}

/** "On the day", "2 days before", "A week before". */
export function reminderLabel(daysBefore: number): string {
  if (daysBefore === 0) return 'On the day'
  if (daysBefore === 1) return '1 day before'
  if (daysBefore === 7) return 'A week before'
  return `${daysBefore} days before`
}
