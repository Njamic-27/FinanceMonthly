import { Notification } from 'electron'
import type { IsoDate } from '@shared/dates'
import type { UpcomingPayment } from '@shared/planned'
import type { Settings } from '@shared/settings'
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
