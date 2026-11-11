import type { settings as en } from '../en/settings'
import type { Translation } from '../types'

export const settings: Translation<typeof en> = {
  'settings.language': 'Jezik',
  'settings.languageHint': 'Format brojeva i datuma postavlja se zasebno, niže.',
  'settings.system': 'Sustav',
  'settings.light': 'Svijetla',
  'settings.dark': 'Tamna',
  'settings.backupAndRestoreCsv':
    'Sigurnosna kopija i vraćanje, CSV izvoz i brisanje podataka (korak 56)',
  'settings.settingsNotSaved': 'Postavke nisu spremljene',
  'settings.moneyAndDates': 'Novac i datumi',
  'settings.currency': 'Valuta',
  'settings.theCurrencyAllYour': 'Valuta koju koriste svi tvoji računi.',
  'settings.numberAndDateFormat': 'Format brojeva i datuma',
  'settings.decimalSeparatorDigitGrouping':
    'Decimalni separator, grupiranje znamenki i redoslijed datuma.',
  'settings.numberAndDateFormat2': 'Format brojeva i datuma promijenjen',
  'settings.firstDayOfThe': 'Prvi dan u tjednu',
  'settings.appearance': 'Izgled',
  'settings.systemFollowsTheWindows': 'Sustav prati svijetli ili tamni način Windowsa.',
  'settings.remindersAndStartup': 'Podsjetnici i pokretanje',
  'settings.remindersArriveWhileFinancije':
    'Podsjetnici stižu dok je FinanceMonthly otvoren ili radi u traci.',
  'settings.paymentReminders': 'Podsjetnici za plaćanja',
  'settings.aWindowsNotificationBefore':
    'Obavijest u Windowsima prije dospijeća režija i pretplata. Koliko dana prije postavljaš za svaku pod Ponavljajuće.',
  'settings.remindersTurnedOn': 'Podsjetnici uključeni',
  'settings.remindersTurnedOff': 'Podsjetnici isključeni',
  'settings.keepRunningInThe': 'Nastavi raditi u traci',
  'settings.closingTheWindowLeaves':
    'Zatvaranje prozora ostavlja FinanceMonthly u traci, pa podsjetnici i dalje stižu. Izlaz je u izborniku ikone u traci.',
  'settings.startWithWindows': 'Pokreni s Windowsima',
  'settings.startsInTheTray':
    'Pokreće se u traci kad se prijaviš, pa podsjetnici stižu bez otvaranja.',
  'settings.startsWhenYouSign': 'Pokreće se kad se prijaviš, pa podsjetnici stižu bez otvaranja.',
  'settings.moreSettingsOnThe': 'Još postavki uskoro',
  'settings.currencyFormatsThemeAnd': 'Valuta, formati, tema i podsjetnici.',
  'settings.settingsCouldNotBe': 'Postavke se nisu mogle učitati',
  'settings.formatHint': 'Kako iznosi i datumi izgledaju u cijeloj aplikaciji: {amount} · {date}',
  'settings.currencyHint':
    'Promjena valute mijenja samo oznaku. Iznosi se ne preračunavaju, pa {amount} ostaje 100 u novoj valuti.',
  'settings.currencyChanged': 'Valuta promijenjena u {currency}',
  'settings.weeksRun': 'Tjedni traju od {from} do {to} u tjednim prikazima i kalendaru.',
  'settings.weeksStart': 'Tjedni sad počinju: {day}',
  'settings.restartToRetry': '{error} Ponovno pokreni FinanceMonthly i pokušaj opet.'
}
