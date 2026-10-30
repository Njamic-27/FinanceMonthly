import type { Message } from '../types'

export const calendar = {
  'calendar.previousMonth': 'Previous month',
  'calendar.nextMonth': 'Next month',
  'calendar.youCanPlanUp': 'You can plan up to 24 months ahead',
  'calendar.chooseAMonth': 'Choose a month',
  'calendar.previousYear': 'Previous year',
  'calendar.nextYear': 'Next year',
  'calendar.whatHappenedAndWhats': 'What happened and what’s coming, day by day.',
  'calendar.theCalendarCouldNot': 'The calendar could not be loaded',
  'calendar.installmentChargedAutomatically': 'Installment, charged automatically',
  'calendar.loanInstallmentOverdue': 'Loan installment, overdue',
  'calendar.loanInstallment': 'Loan installment',
  'calendar.viewCard': 'View card',
  'calendar.selectedDay': 'Selected day',
  'calendar.cardPaymentsDue': 'Card payments due',
  'calendar.payingACardMoves':
    'Paying a card moves money between your accounts, so it isn’t counted as spending.',
  'calendar.notMarkedPaidYet':
    'Not marked paid yet. Mark it paid with what you actually paid, or skip it under Recurring.',
  'calendar.nothingRecordedYet': 'Nothing recorded yet.',
  'calendar.nothingRecordedOnThis': 'Nothing recorded on this day.',
  'calendar.showMore': 'Show more',
  'calendar.monthSummary': 'Month summary',
  'calendar.incomeWithPlanned': 'Income, with planned',
  'calendar.moneyOutWithPlanned': 'Money out, with planned',
  'calendar.net': 'Net',
  'calendar.todaysBalanceWithEverything': 'Today’s balance with everything planned until then',
  'calendar.openItsDayTo': 'Open its day to mark it paid.',
  'calendar.overdue': {
    one: '{count} planned payment this month is overdue.',
    other: '{count} planned payments this month are overdue.'
  },
  'calendar.cardPayment': '{label}, card payment',
  'calendar.more': '+{count} more',
  'calendar.moneyOutCaption': 'Spending, loan payments and savings'
} satisfies Record<string, Message>
