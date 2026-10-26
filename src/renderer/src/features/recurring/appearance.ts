import type { RecurringKind } from '@shared/recurring'

export const kindLabels: Record<RecurringKind, { noun: string; placeholder: string }> = {
  income: { noun: 'recurring income', placeholder: 'e.g. Salary' },
  expense: { noun: 'recurring expense', placeholder: 'e.g. Rent' },
  subscription: { noun: 'subscription', placeholder: 'e.g. Netflix' }
}
