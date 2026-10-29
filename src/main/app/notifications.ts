import { Notification } from 'electron'
import type { IsoDate } from '@shared/dates'
import { monthKeyOf, monthRowPath } from '@shared/month'
import type { UpcomingPayment } from '@shared/planned'
import type { Settings } from '@shared/settings'
import { cardReminderMessage, type CardReminder } from '../services/cards'
import { reminderMessages } from '../services/reminders'
import { showMainWindow } from './shell'

/** Shows reminders as Windows notifications; clicking one opens its screen. */
export function showReminders(
  reminders: UpcomingPayment[],
  accounts: Map<number, string>,
  settings: Pick<Settings, 'currency' | 'locale'>,
  today: IsoDate,
  icon: string
): boolean {
  if (!Notification.isSupported()) return false
  for (const { title, body, path } of reminderMessages(reminders, accounts, settings, today)) {
    const notification = new Notification({ title, body, icon })
    notification.on('click', () => showMainWindow(path))
    notification.show()
  }
  return true
}

/** Shows credit card reminders; clicking one opens the card's row on Month, the bill's month. */
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
    notification.on('click', () =>
      showMainWindow(
        monthRowPath(monthKeyOf(reminder.dueDate ?? reminder.date), {
          kind: 'card_payment',
          sourceId: reminder.accountId
        })
      )
    )
    notification.show()
  }
  return true
}
