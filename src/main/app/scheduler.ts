import { powerMonitor } from 'electron'
import { today } from '@shared/dates'
import { getDb } from '../db'
import { listAccounts } from '../db/repositories/accounts'
import { getSettings } from '../db/repositories/settings'
import { postDueInstallments, postDueItems, postDueLoanInstallments } from '../services/posting'
import { dueCardReminders, markCardNotified } from '../services/cards'
import { dueReminders, markNotified } from '../services/reminders'
import { showCardReminders, showReminders } from './notifications'
import { sendToRenderer } from './shell'

const HOUR = 60 * 60 * 1000

let icon = ''

/**
 * The work that depends on the date: posting payments that have fallen due and announcing
 * reminders. Runs on launch, every hour while Financije runs (in the tray too) and when the
 * computer wakes up, so a new day is noticed without a restart.
 */
export function runScheduledWork(): void {
  const db = getDb()
  const now = today()
  try {
    const posted =
      postDueItems(db, now) + postDueInstallments(db, now) + postDueLoanInstallments(db, now)
    if (posted > 0) {
      console.log(`Posted ${posted} recurring, installment or loan transaction(s)`)
      sendToRenderer('data:changed')
    }
  } catch (error) {
    // The payments stay due and are tried again on the next run.
    console.error('[scheduler] could not post due recurring items:', error)
  }

  try {
    const settings = getSettings(db)
    if (!settings.notificationsEnabled) return
    const reminders = dueReminders(db, now)
    const cardReminders = dueCardReminders(db, now)
    if (reminders.length === 0 && cardReminders.length === 0) return
    const accounts = new Map(listAccounts(db).map((a) => [a.id, a.name]))
    if (reminders.length > 0 && showReminders(reminders, accounts, settings, now, icon)) {
      markNotified(
        db,
        reminders.map((r) => r.planned)
      )
    }
    if (cardReminders.length > 0 && showCardReminders(cardReminders, settings, now, icon)) {
      markCardNotified(db, cardReminders)
    }
    sendToRenderer('data:changed')
  } catch (error) {
    console.error('[scheduler] could not show reminders:', error)
  }
}

/** Runs the scheduled work now, then every hour and on wake; `appIcon` goes on notifications. */
export function startScheduler(appIcon: string): void {
  icon = appIcon
  runScheduledWork()
  setInterval(runScheduledWork, HOUR)
  powerMonitor.on('resume', runScheduledWork)
}
