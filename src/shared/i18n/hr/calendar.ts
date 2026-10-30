import type { calendar as en } from '../en/calendar'
import type { Translation } from '../types'

export const calendar: Translation<typeof en> = {
  'calendar.previousMonth': 'Prethodni mjesec',
  'calendar.nextMonth': 'Sljedeći mjesec',
  'calendar.youCanPlanUp': 'Možeš planirati do 24 mjeseca unaprijed',
  'calendar.chooseAMonth': 'Odaberi mjesec',
  'calendar.previousYear': 'Prethodna godina',
  'calendar.nextYear': 'Sljedeća godina',
  'calendar.whatHappenedAndWhats': 'Što se dogodilo i što dolazi, dan po dan.',
  'calendar.theCalendarCouldNot': 'Kalendar se nije mogao učitati',
  'calendar.installmentChargedAutomatically': 'Rata, naplaćuje se automatski',
  'calendar.loanInstallmentOverdue': 'Rata zajma, kasni',
  'calendar.loanInstallment': 'Rata zajma',
  'calendar.viewCard': 'Pogledaj karticu',
  'calendar.selectedDay': 'Odabrani dan',
  'calendar.cardPaymentsDue': 'Dospjela plaćanja kartica',
  'calendar.payingACardMoves':
    'Plaćanje kartice prebacuje novac između tvojih računa, pa se ne broji kao potrošnja.',
  'calendar.notMarkedPaidYet':
    'Još nije označeno plaćenim. Označi ga stvarnim iznosom ili ga preskoči pod Ponavljajuće.',
  'calendar.nothingRecordedYet': 'Još ništa nije zabilježeno.',
  'calendar.nothingRecordedOnThis': 'Ovaj dan ništa nije zabilježeno.',
  'calendar.showMore': 'Prikaži više',
  'calendar.monthSummary': 'Sažetak mjeseca',
  'calendar.incomeWithPlanned': 'Prihodi, s planiranim',
  'calendar.moneyOutWithPlanned': 'Odljevi, s planiranim',
  'calendar.net': 'Neto',
  'calendar.todaysBalanceWithEverything': 'Današnje stanje sa svime što je planirano do tada',
  'calendar.openItsDayTo': 'Otvori njegov dan da ga označiš plaćenim.',
  'calendar.overdue': {
    one: '{count} planirano plaćanje ovog mjeseca kasni.',
    few: '{count} planirana plaćanja ovog mjeseca kasne.',
    other: '{count} planiranih plaćanja ovog mjeseca kasni.'
  },
  'calendar.cardPayment': '{label}, plaćanje kartice',
  'calendar.more': '+{count} još',
  'calendar.moneyOutCaption': 'Potrošnja, otplate zajmova i štednja'
}
