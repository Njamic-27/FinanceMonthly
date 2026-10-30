import type { errors as en } from '../en/errors'
import type { Translation } from '../types'

export const errors: Translation<typeof en> = {
  'errors.accountGone': 'Taj račun više ne postoji.',
  'errors.choosePayFrom': 'Odaberi račun s kojeg se plaća račun kartice',
  'errors.payFromNotCard':
    'Račun kartice plaća se s debitnog računa ili gotovinom, ne drugom karticom',
  'errors.notAdjustment': 'Ta transakcija nije ispravak stanja.',
  'errors.notBankLoan': 'To nije kredit.',
  'errors.installmentGone': 'Ta rata više ne postoji.',
  'errors.categoryGone': 'Ta kategorija više ne postoji.',
  'errors.mergeDifferent': 'Odaberi drugu kategoriju za spajanje.',
  'errors.planGone': 'Ta kupnja na rate više ne postoji.',
  'errors.installmentsOnCard': 'Na rate se mogu plaćati samo kupnje kreditnom karticom.',
  'errors.expenseCategoryActive': 'Odaberi kategoriju troška koja nije arhivirana.',
  'errors.loanGone': 'Taj zajam više ne postoji.',
  'errors.bankLoanOwnScreen': 'Krediti se uređuju na svom ekranu.',
  'errors.bankLoanByInstallment': 'Kredit se otplaćuje ratu po ratu.',
  'errors.notRepayment': 'To nije povrat zajma.',
  'errors.installmentAsScheduled':
    'Rata se plaća prema planu. Poništi uplatu i plati je ponovno da je promijeniš.',
  'errors.nothingToReopen': 'Sve je vraćeno, pa nema što ponovno otvoriti.',
  'errors.recurringGone': 'Ta ponavljajuća stavka više ne postoji.',
  'errors.staysIncome':
    'Njezina prošla plaćanja knjižena su kao prihod, pa ostaje prihod. Umjesto toga dodaj novu stavku.',
  'errors.staysExpense':
    'Njezina prošla plaćanja knjižena su kao troškovi, pa ostaje trošak. Umjesto toga dodaj novu stavku.',
  'errors.goalGone': 'Taj cilj štednje više ne postoji.',
  'errors.goalStartTooLow':
    'Iz ovog cilja podignuto je više nego što bi u njemu ostalo. Zadrži veći početni iznos.',
  'errors.notSavingsMovement': 'To nije uplata ni podizanje štednje.',
  'errors.transactionGone': 'Ta transakcija više ne postoji.',
  'errors.installmentStaysOnCard': 'Rate ostaju na kartici kojom je kupljeno.',
  'errors.movementsOwnScreens': 'Štednja i zajmovi uređuju se na svojim ekranima.',
  'errors.deleteWholePurchase':
    'Ovo je jedna rata kupnje. Umjesto toga obriši cijelu kupnju na stranici kartice.',
  'errors.invalidInput': 'Neispravan unos',
  'errors.alreadyExists': 'To već postoji.',
  'errors.rejected': 'Baza podataka odbila je podatke.',
  'errors.somethingWrong': 'Nešto je pošlo po krivu.',
  'errors.addAccountFirst': 'Prvo dodaj račun.',
  'errors.rowsOwnSection': 'Retci se mogu pomicati samo unutar svog odjeljka.',
  'errors.chooseRowAccount': 'Prvo odaberi račun za ovaj redak.',
  'errors.cardGone': 'Ta kartica više ne postoji.',
  'errors.repaymentsOnPage': 'Povrate ovog zajma bilježi na njegovoj stranici.',
  'errors.onlyCategoryRow': 'Odjednom se mogu ukloniti samo iznosi retka kategorije.',
  'errors.couldNotOpen': 'Financije nije mogao otvoriti svoje podatke',
  'errors.archived': '„{name}” je arhiviran. Vrati ga da ga opet koristiš.',
  'errors.loanStarted': 'Zajam je počeo {date}. Odaberi taj dan ili kasniji.',
  'errors.cardStartsLater':
    '„{name}” počinje {date}. Odaberi kasniji datum ili pomakni početni datum kartice.',
  'errors.accountStartsLater':
    '„{name}” počinje {date}. Odaberi kasniji datum ili pomakni početni datum računa.',
  'errors.accountExists': 'Već imaš račun „{name}”.',
  'errors.staysCard': '„{name}” ima kupnje na rate, pa mora ostati kreditna kartica.',
  'errors.accountInUse':
    '„{name}” ima povezane transakcije ili planove. Umjesto toga ga arhiviraj da zadržiš povijest.',
  'errors.archivedBalance': '„{name}” je arhiviran. Vrati ga da ispraviš stanje.',
  'errors.changeStartingBalance': '„{name}” počinje {date}. Umjesto toga promijeni početno stanje.',
  'errors.installmentsPaid': {
    one: '{count} rata već je plaćena, pa iznos, kamata i datumi ostaju isti.',
    few: '{count} rate već su plaćene, pa iznos, kamata i datumi ostaju isti.',
    other: '{count} rata već je plaćeno, pa iznos, kamata i datumi ostaju isti.'
  },
  'errors.installmentPaid': 'Rata {seq} već je plaćena.',
  'errors.categoryInUse':
    '„{name}” koristi {count} transakcija, ponavljajućih stavki ili kupnji na rate. Umjesto toga je arhiviraj ili spoji u drugu kategoriju.',
  'errors.goalArchived': '„{name}” je arhiviran. Vrati ga da opet štediš u njega.',
  'errors.goalInUse':
    '„{name}” ima uplate ili podizanja. Umjesto toga ga arhiviraj da zadržiš povijest.',
  'errors.repaidAlready': '{amount} već je vraćeno. Upiši barem toliko.',
  'errors.onlyOwed': 'Duguje se još samo {amount}.',
  'errors.loanClosed': '„{title}” je već zatvoren.',
  'errors.onSheet': '„{name}” je već na tablici.',
  'errors.incomeCategoryActive': 'Odaberi kategoriju prihoda koja nije arhivirana.',
  'errors.notCard': '„{name}” nije kreditna kartica.',
  'errors.calendarUpTo': 'Kalendar ide do: {month}.',
  'errors.notDueOn': '„{title}” ne dospijeva {date}.',
  'errors.alreadyPosted': 'To plaćanje za „{title}” već je proknjiženo ili preskočeno.',
  'errors.skipEarlier': 'Prvo preskoči ranija plaćanja za „{title}”.',
  'errors.notDueThisMonth': '„{title}” ne dospijeva ovaj mjesec.',
  'errors.dueTwice':
    '„{title}” dospijeva više puta ovaj mjesec. Promijeni svako plaćanje na njegovu popisu.',
  'errors.noInstallmentDue': 'Nijedna rata za „{title}” ne dospijeva ovaj mjesec.',
  'errors.archivedIncomeCategory':
    'Arhivirana kategorija prihoda već se zove „{name}”. Umjesto toga je vrati.',
  'errors.archivedExpenseCategory':
    'Arhivirana kategorija troška već se zove „{name}”. Umjesto toga je vrati.',
  'errors.incomeCategoryExists': 'Već postoji kategorija prihoda „{name}”.',
  'errors.expenseCategoryExists': 'Već postoji kategorija troška „{name}”.',
  'errors.mergeIncome':
    '„{name}” je kategorija prihoda, pa se može spojiti samo u drugu kategoriju prihoda.',
  'errors.mergeExpense':
    '„{name}” je kategorija troška, pa se može spojiti samo u drugu kategoriju troška.',
  'errors.loanPaidOff': '„{title}” je otplaćen. Ponovno ga otvori da zabilježiš još.',
  'errors.loanWrittenOff': '„{title}” je otpisan. Ponovno ga otvori da zabilježiš još.',
  'errors.planIncome': 'Ovaj prihod proknjižen je iz plana, pa ostaje prihod.',
  'errors.planExpense': 'Ovaj trošak proknjižen je iz plana, pa ostaje trošak.',
  'errors.chooseIncomeCategory': '„{name}” je kategorija troška. Odaberi kategoriju prihoda.',
  'errors.chooseExpenseCategory': '„{name}” je kategorija prihoda. Odaberi kategoriju troška.',
  'errors.cardStartsBack':
    '„{name}” počinje {date}. Odaberi kasniji datum ili prvo pomakni početni datum kartice unatrag.',
  'errors.accountStartsBack':
    '„{name}” počinje {date}. Odaberi kasniji datum ili prvo pomakni početni datum računa unatrag.',
  'errors.staysLent': 'Nešto je već vraćeno, pa ostaje zajam koji si dao.',
  'errors.staysBorrowed': 'Nešto je već vraćeno, pa ostaje zajam koji si uzeo.',
  'errors.goalOnlyHas': '„{name}” ima samo {amount} za podizanje.',
  'errors.goalBelowZero':
    'Iz „{name}” je od tada podignuto više. Brisanje ove uplate od {amount} ostavilo bi ga ispod nule.',
  'errors.rowHasMore':
    '„{title}” ovaj mjesec već ima {amount} u transakcijama. Upiši barem toliko ili promijeni te transakcije.',
  'errors.installmentInFull':
    'Rata {seq} iznosi {amount} i plaća se u cijelosti. Upiši taj iznos da je označiš plaćenom ili 0 da poništiš uplatu.',
  'errors.databaseFile': '{error}\n\nDatoteka baze: {path}'
}
