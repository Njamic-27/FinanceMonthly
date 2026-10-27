import { Notification } from 'electron'
import type { IsoDate } from '@shared/dates'
import type { UpcomingPayment } from '@shared/planned'
import type { Settings } from '@shared/settings'
import { cardReminderMessage, type CardReminder } from '../services/cards'
import { reminderMessages } from '../services/reminders'
import { showMainWindow } from './shell'

/** Shows reminders as Windows notifications; clicking one opens the Recurring screen. */
export function showReminders(
  reminders: UpcomingPayment[],
  accounts: Map<number, string>,
  settings: Pick<Settings, 'currency' | 'locale'>,
  today: IsoDate,
  icon: string
): boolean {
  if (!Notification.isSupported()) return false
  for (const content of reminderMessages(reminders, accounts, settings, today)) {
    const notification = new Notification({ ...content, icon })
    notification.on('click', () => showMainWindow('/recurring'))
    notification.show()
  }
  return true
}

/** Shows credit card reminders; clicking one opens that card. */
export function showCardReminders(
  reminders: CardReminder[],
  settings: Pick<Settings, 'currency' | 'locale'>,
  today: IsoDate,
  icon: string
): boolean {
  if (!Notification.isSupported()) return false
  for (const reminder of reminders) {
    const notification = new Notification({
      ...cardReminderMessage(reminder, settings, today),
      icon
    })
    notification.on('click', () => showMainWindow(`/accounts/${reminder.accountId}`))
    notification.show()
  }
  return true
}
