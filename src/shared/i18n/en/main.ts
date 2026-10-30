import type { Message } from '../types'

export const main = {
  'tray.open': 'Open Financije',
  'tray.dueNow': 'Due now and coming up',
  'tray.quit': 'Quit Financije',
  'tray.stillRunning': 'Financije is still running',
  'tray.stillRunningHint':
    'It stays in the tray to remind you of payments. Right-click the icon to quit.',
  'reminder.today': 'today',
  'reminder.tomorrow': 'tomorrow',
  'reminder.on': 'on {date}',
  'reminder.manyTitle': { one: '{count} payment coming up', other: '{count} payments coming up' },
  'reminder.andMore': 'and {count} more',
  'reminder.line': '{title} {amount}, {when}',
  'reminder.isDue': '{title} is due {when}',
  'reminder.arrives': '{title} arrives {when}',
  'reminder.cardDue': '{card} payment due {when}',
  'reminder.cardLeft': '{amount} left to pay on this statement.',
  'reminder.statementClosed': '{card} statement closed',
  'reminder.toPay': '{amount} to pay.',
  'reminder.toPayBy': '{amount} to pay by {date}.'
} satisfies Record<string, Message>
