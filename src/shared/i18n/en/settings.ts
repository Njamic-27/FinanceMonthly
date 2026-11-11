import type { Message } from '../types'

// Settings (the rest of the screen follows in step 54).
export const settings = {
  'settings.language': 'Language',
  'settings.languageHint': 'Number and date format is set on its own, below.',
  'settings.system': 'System',
  'settings.light': 'Light',
  'settings.dark': 'Dark',
  'settings.backupAndRestoreCsv': 'Backup and restore, CSV export and reset data (step 56)',
  'settings.settingsNotSaved': 'Settings not saved',
  'settings.moneyAndDates': 'Money and dates',
  'settings.currency': 'Currency',
  'settings.theCurrencyAllYour': 'The currency all your accounts use.',
  'settings.numberAndDateFormat': 'Number and date format',
  'settings.decimalSeparatorDigitGrouping': 'Decimal separator, digit grouping and date order.',
  'settings.numberAndDateFormat2': 'Number and date format changed',
  'settings.firstDayOfThe': 'First day of the week',
  'settings.appearance': 'Appearance',
  'settings.systemFollowsTheWindows': 'System follows the Windows light or dark mode.',
  'settings.remindersAndStartup': 'Reminders and startup',
  'settings.remindersArriveWhileFinancije':
    'Reminders arrive while FinanceMonthly is open or running in the tray.',
  'settings.paymentReminders': 'Payment reminders',
  'settings.aWindowsNotificationBefore':
    'A Windows notification before bills and subscriptions are due. Set how many days before on each one under Recurring.',
  'settings.remindersTurnedOn': 'Reminders turned on',
  'settings.remindersTurnedOff': 'Reminders turned off',
  'settings.keepRunningInThe': 'Keep running in the tray',
  'settings.closingTheWindowLeaves':
    'Closing the window leaves FinanceMonthly in the tray, so reminders still arrive. Quit from the tray icon’s menu.',
  'settings.startWithWindows': 'Start with Windows',
  'settings.startsInTheTray':
    'Starts in the tray when you sign in, so reminders arrive without opening it.',
  'settings.startsWhenYouSign': 'Starts when you sign in, so reminders arrive without opening it.',
  'settings.moreSettingsOnThe': 'More settings on the way',
  'settings.currencyFormatsThemeAnd': 'Currency, formats, theme and reminders.',
  'settings.settingsCouldNotBe': 'Settings could not be loaded',
  'settings.formatHint': 'How amounts and dates look throughout the app: {amount} · {date}',
  'settings.currencyHint':
    'Changing the currency only changes the symbol. Amounts are not converted, so {amount} stays 100 in the new currency.',
  'settings.currencyChanged': 'Currency changed to {currency}',
  'settings.weeksRun': 'Weeks run {from} to {to} in weekly views and the calendar.',
  'settings.weeksStart': 'Weeks now start on {day}',
  'settings.restartToRetry': '{error} Restart FinanceMonthly to try again.'
} satisfies Record<string, Message>
