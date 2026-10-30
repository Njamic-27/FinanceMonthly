import type { recurring as en } from '../en/recurring'
import type { Translation } from '../types'

export const recurring: Translation<typeof en> = {
  'recurring.weekly': 'Tjedno',
  'recurring.monthly': 'Mjesečno',
  'recurring.yearly': 'Godišnje',
  'recurring.addItAutomatically': 'Dodaj automatski',
  'recurring.askMeFirst': 'Prvo me pitaj',
  'recurring.never': 'Nikad',
  'recurring.onADate': 'Na datum',
  'recurring.enterAnAmountAbove': 'Upiši iznos veći od nule',
  'recurring.nothingIsAddedUntil': 'Ništa se ne dodaje dok ga ponovno ne pokreneš.',
  'recurring.itHasNoPayments': 'Nema više plaćanja prije svog datuma završetka.',
  'recurring.nothingAfterTodayWill': 'Ništa nakon danas neće se dodati.',
  'recurring.nothingMoreWillBe': 'Za njega se više ništa neće dodavati.',
  'recurring.thisCantBeUndone': 'Ovo se ne može poništiti.',
  'recurring.moneyYouReceiveOn': 'Novac koji primaš po rasporedu, poput plaće.',
  'recurring.aPaymentThatRepeats': 'Plaćanje koje se ponavlja po rasporedu.',
  'recurring.repeats': 'Ponavlja se',
  'recurring.nextDate': 'Sljedeći datum',
  'recurring.firstDate': 'Prvi datum',
  'recurring.ends': 'Završava',
  'recurring.whenItsDue': 'Kad dospije',
  'recurring.addedToYourTransactions':
    'Dodaje se u tvoje transakcije na taj dan, čak i ako je Financije bio zatvoren.',
  'recurring.waitsUnderDueNow':
    'Čeka pod „Čeka na tebe” dok ga ne potvrdiš, s iznosom koji si stvarno platio.',
  'recurring.remindMe': 'Podsjeti me',
  'recurring.noReminder': 'Bez podsjetnika',
  'recurring.whereYouManageIt': 'Gdje njime upravljaš',
  'recurring.nothingIsAddedOr': 'Ništa se ne dodaje niti traži dok ga ponovno ne pokreneš.',
  'recurring.itContinuesFromIts':
    'Nastavlja od svog sljedećeg datuma. Plaćanja propuštena dok je bio pauziran izostavljaju se.',
  'recurring.end': 'Završi',
  'recurring.itEndsTodaySo':
    'Završava danas, pa se ništa nakon danas ne dodaje. Za ponovni početak postavi novi sljedeći datum i završetak.',
  'recurring.cancelSubscription': 'Otkaži pretplatu',
  'recurring.endToday': 'Završi danas',
  'recurring.itHasEndedRemove': 'Završio je. Ukloni ga s popisa; ono što je dodao ostaje.',
  'recurring.removeItForGood': 'Ukloni ga zauvijek. Ono što je već dodao ostaje.',
  'recurring.delete': 'Obriši…',
  'recurring.chooseAnAccount': 'Odaberi račun',
  'recurring.confirm': 'Potvrdi',
  'recurring.pay': 'Plati',
  'recurring.receivedOn': 'Primljeno',
  'recurring.paidOn': 'Plaćeno',
  'recurring.markAsReceived': 'Označi kao primljeno',
  'recurring.markAsPaid': 'Označi kao plaćeno',
  'recurring.newSubscription': 'Nova pretplata',
  'recurring.pickTheServiceTo':
    'Odaberi uslugu da se upiše njezin naziv. Cijenu i datum naplate upisuješ zatim.',
  'recurring.custom': 'Drugo',
  'recurring.orTheLastDay': ' (ili zadnji dan kraćih mjeseci)',
  'recurring.enterTheAmount': 'Upiši iznos',

  'recurring.unit.weekly': { one: 'tjedan', few: 'tjedna', other: 'tjedana' },
  'recurring.unit.monthly': { one: 'mjesec', few: 'mjeseca', other: 'mjeseci' },
  'recurring.unit.yearly': { one: 'godina', few: 'godine', other: 'godina' },
  'recurring.paymentsAdded': {
    one: '{count} plaćanje dodano u tvoje transakcije.',
    few: '{count} plaćanja dodana u tvoje transakcije.',
    other: '{count} plaćanja dodano u tvoje transakcije.'
  },
  'recurring.paymentsAddedShort': {
    one: '{count} plaćanje dodano.',
    few: '{count} plaćanja dodana.',
    other: '{count} plaćanja dodano.'
  },
  'recurring.nextOn': 'Sljedeće {date}.',
  'recurring.deleteKeeps': {
    one: 'Za njega se više ništa neće dodavati. {count} transakcija koju je već dodao ostaje u povijesti.',
    few: 'Za njega se više ništa neće dodavati. {count} transakcije koje je već dodao ostaju u povijesti.',
    other:
      'Za njega se više ništa neće dodavati. {count} transakcija koje je već dodao ostaje u povijesti.'
  },
  'recurring.alreadyDueSave': {
    one: '{count} plaćanje već je dospjelo i dodat će se kad spremiš.',
    few: '{count} plaćanja već su dospjela i dodat će se kad spremiš.',
    other: '{count} plaćanja već je dospjelo i dodat će se kad spremiš.'
  },
  'recurring.alreadyDue': {
    one: '{count} plaćanje već je dospjelo.',
    few: '{count} plaćanja već su dospjela.',
    other: '{count} plaćanja već je dospjelo.'
  },
  'recurring.savedToast': 'Spremljeno: {title}',
  'recurring.addedToast': 'Dodano: {title}',
  'recurring.cancelledToast': 'Otkazano: {title}',
  'recurring.endedToast': 'Završeno: {title}',
  'recurring.accountStarts': '{account} počinje {date}. Odaberi taj dan ili kasniji.',
  'recurring.add.income': 'Dodaj ponavljajući prihod',
  'recurring.add.expense': 'Dodaj ponavljajući trošak',
  'recurring.add.subscription': 'Dodaj pretplatu',
  'recurring.new.income': 'Novi ponavljajući prihod',
  'recurring.new.expense': 'Novi ponavljajući trošak',
  'recurring.new.subscription': 'Nova pretplata',
  'recurring.edit.income': 'Uredi ponavljajući prihod',
  'recurring.edit.expense': 'Uredi ponavljajući trošak',
  'recurring.edit.subscription': 'Uredi pretplatu',
  'recurring.delete.income': 'Obriši ponavljajući prihod',
  'recurring.delete.expense': 'Obriši ponavljajući trošak',
  'recurring.delete.subscription': 'Obriši pretplatu',
  'recurring.placeholder.income': 'npr. Plaća',
  'recurring.placeholder.expense': 'npr. Najamnina',
  'recurring.placeholder.subscription': 'npr. Netflix',
  'recurring.reminder.onDay': 'Na dan',
  'recurring.reminder.weekBefore': 'Tjedan dana prije',
  'recurring.reminder.daysBefore': {
    one: '{count} dan prije',
    few: '{count} dana prije',
    other: '{count} dana prije'
  },
  'schedule.weekly': 'Svaki tjedan',
  'schedule.monthly': 'Mjesečno',
  'schedule.yearly': 'Godišnje',
  'schedule.every.weekly': {
    one: 'Svakih {count} tjedan',
    few: 'Svaka {count} tjedna',
    other: 'Svakih {count} tjedana'
  },
  'schedule.every.monthly': {
    one: 'Svakih {count} mjesec',
    few: 'Svaka {count} mjeseca',
    other: 'Svakih {count} mjeseci'
  },
  'schedule.every.yearly': {
    one: 'Svakih {count} godinu',
    few: 'Svake {count} godine',
    other: 'Svakih {count} godina'
  },
  'schedule.onWeekday': '{repeat}, {weekday}',
  'schedule.onDay': '{repeat}, {day} u mjesecu{shortMonths}',
  'schedule.onDate': '{repeat}, {date}',
  'recurring.confirmTitle': 'Potvrdi „{title}”',
  'recurring.payTitle': 'Plati „{title}”',
  'recurring.dueOn': 'Dospijeva {date}. Promijeni sve što je ovaj put bilo drukčije.',
  'recurring.website': 'Web stranica',
  'recurring.reminderLabel': 'Podsjetnik: {when}',
  'recurring.endedOn': 'Završeno {date}',
  'recurring.nextOnLink': 'Sljedeće {date}',
  'recurring.aYear': ' · {amount} godišnje',
  'recurring.asksFirst': ' · prvo pita',
  'recurring.aMonthShort': 'mjesečno',
  'recurring.aYearShort': 'godišnje',
  'recurring.averaged': 'Prosjek kroz godinu, iz: {items}. Pauzirani i završeni se ne broje.',
  'recurring.count.subscription': {
    one: '{count} pretplate',
    few: '{count} pretplate',
    other: '{count} pretplata'
  },
  'recurring.count.income': {
    one: '{count} izvora prihoda',
    few: '{count} izvora prihoda',
    other: '{count} izvora prihoda'
  },
  'recurring.count.expense': {
    one: '{count} režije',
    few: '{count} režije',
    other: '{count} režija'
  },
  'recurring.overdueSince': 'Kasni od {date}',
  'recurring.reminderOn': 'Podsjetnik {date}',
  'recurring.yourSubscriptionsCost': 'Tvoje pretplate koštaju',
  'recurring.noSubscriptionsYetAdd':
    'Još nema pretplata. Dodaj usluge koje redovno plaćaš, poput streaminga ili softvera.',
  'recurring.yourRecurringIncomeBrings': 'Tvoji ponavljajući prihodi donose',
  'recurring.noRecurringIncomeYet':
    'Još nema ponavljajućih prihoda. Dodaj plaću da se dodaje na dan isplate.',
  'recurring.yourRecurringExpensesCost': 'Tvoji ponavljajući troškovi iznose',
  'recurring.noRecurringExpensesYet':
    'Još nema ponavljajućih troškova. Dodaj najamninu, režije ili druge redovne račune.',
  'recurring.subscriptionsRegularBillsAnd':
    'Pretplate, redovne režije i redovni prihodi, dodani kad dospiju.',
  'recurring.recurringItemsCouldNot': 'Ponavljajuće stavke nisu se mogle učitati',
  'recurring.kind': 'Vrsta',
  'recurring.ended': 'Završeno',
  'recurring.pastTheirEndDate':
    'Prošao im je datum završetka. Ono što su dodali ostaje u transakcijama.',
  'recurring.tomorrow': 'Sutra',
  'recurring.remindersAreOff': 'Podsjetnici su isključeni',
  'recurring.reminderSent': 'Podsjetnik poslan',
  'recurring.reminderDue': 'Podsjetnik stiže',
  'recurring.comingUp': 'Uskoro',
  'recurring.theNext14Days': 'Sljedećih 14 dana.',
  'recurring.nothingPlannedInThe': 'U sljedećih 14 dana ništa nije planirano.',
  'recurring.openTheCalendar': 'Otvori kalendar',
  'recurring.dueNow': 'Dospijeva sada',
  'recurring.confirmEachPaymentTo':
    'Potvrdi svako plaćanje da ga dodaš u transakcije ili ga preskoči ako se nije dogodilo.'
}
