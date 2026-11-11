import type { main as en } from '../en/main'
import type { Translation } from '../types'

export const main: Translation<typeof en> = {
  'tray.open': 'Otvori FinanceMonthly',
  'tray.dueNow': 'Dospjelo i uskoro',
  'tray.quit': 'Zatvori FinanceMonthly',
  'tray.stillRunning': 'FinanceMonthly i dalje radi',
  'tray.stillRunningHint':
    'Ostaje u traci da te podsjeća na plaćanja. Za izlaz desnim klikom na ikonu.',
  'reminder.today': 'danas',
  'reminder.tomorrow': 'sutra',
  'reminder.on': '{date}',
  'reminder.manyTitle': {
    one: '{count} plaćanje uskoro',
    few: '{count} plaćanja uskoro',
    other: '{count} plaćanja uskoro'
  },
  'reminder.andMore': 'i još {count}',
  'reminder.line': '{title} {amount}, {when}',
  'reminder.isDue': '{title} dospijeva {when}',
  'reminder.arrives': '{title} stiže {when}',
  'reminder.cardDue': 'Plaćanje kartice {card} dospijeva {when}',
  'reminder.cardLeft': 'Na ovom izvodu za platiti je još {amount}.',
  'reminder.statementClosed': 'Izvod kartice {card} zatvoren',
  'reminder.toPay': 'Za platiti: {amount}.',
  'reminder.toPayBy': 'Za platiti {amount} do {date}.'
}
