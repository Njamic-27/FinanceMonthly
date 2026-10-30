import type { transactions as en } from '../en/transactions'
import type { Translation } from '../types'

export const transactions: Translation<typeof en> = {
  'transactions.expense': 'Trošak',
  'transactions.transfer': 'Prijenos',
  'transactions.moneyYouSpent': 'Novac koji si potrošio.',
  'transactions.moneyYouReceived': 'Novac koji si primio.',
  'transactions.moneyMovedBetweenYour':
    'Novac prebačen između tvojih računa, npr. gotovina s bankomata ili plaćanje kartice.',
  'transactions.enterTheAmountWithout': 'Upiši iznos bez minusa',
  'transactions.transactionDeleted': 'Transakcija obrisana',
  'transactions.deleteTransaction': 'Obriši transakciju',
  'transactions.editTransaction': 'Uredi transakciju',
  'transactions.swapAccounts': 'Zamijeni račune',
  'transactions.payItAll': 'Plati sve',
  'transactions.theFirstInstallmentCounts': 'Prva rata broji se',
  'transactions.counts': 'Broji se',
  'transactions.duplicate': 'Dupliciraj',
  'transactions.saveTransaction': 'Spremi transakciju',
  'transactions.addInInstallments': 'Dodaj na rate',
  'transactions.addAnAccountFirst': 'Prvo dodaj račun',
  'transactions.everyTransactionIsPaid':
    'Svaka se transakcija plaća s jednog od tvojih računa ili na njega: debitnom karticom, kreditnom karticom ili gotovinom.',
  'transactions.goToAccounts': 'Idi na račune',
  'transactions.transactionNotFound': 'Transakcija nije pronađena',
  'transactions.today': 'Danas',
  'transactions.yesterday': 'Jučer',
  'transactions.addedToTheAccount': 'Dodano na račun',
  'transactions.takenOffTheAccount': 'Skinuto s računa',
  'transactions.enterAnAmountAbove': 'Upiši iznos veći od nule, npr. 25 ili 12,50',
  'transactions.adjustmentSaved': 'Ispravak spremljen',
  'transactions.deleteThisAdjustment': 'Obrisati ovaj ispravak?',
  'transactions.adjustmentDeleted': 'Ispravak obrisan',
  'transactions.deleteAdjustment': 'Obriši ispravak',
  'transactions.editBalanceAdjustment': 'Uredi ispravak stanja',
  'transactions.whichWay': 'U kojem smjeru',
  'transactions.optionalEGWhat': 'Neobavezno, npr. u čemu je bila razlika',
  'transactions.saveAdjustment': 'Spremi ispravak',
  'transactions.addedToast': '{kind}: dodano',
  'transactions.savedToast': '{kind}: spremljeno',
  'transactions.inInstallments': {
    one: '{title} u {count} ratu',
    few: '{title} u {count} rate',
    other: '{title} u {count} rata'
  },
  'transactions.aMonthFrom': '{amount} mjesečno od {date}',
  'transactions.transferPlaceholder': 'npr. Bankomat Ilica',
  'transactions.expensePlaceholder': 'npr. Tjedna kupnja u Lidlu',
  'transactions.deleteDescription':
    '{amount}, {date}. Stanje računa vraća se kakvo je bilo. Ovo se ne može poništiti.',
  'transactions.cardOwes': 'Dug na kartici {card}: {amount}.',
  'transactions.countsIn': '{counts} u mjesecu: {month} — račun kartice {card} dospijeva {date}',
  'transactions.installmentNote':
    'Jedna rata kupnje na kartici. Da je ukloniš, obriši cijelu kupnju na {link}.',
  'transactions.cardsPage': 'stranici kartice',
  'transactions.countsInShort': ' · broji se u mjesecu: {month}',
  'transactions.duplicateTitle': 'Dupliciraj „{title}”',
  'transactions.dayIn': 'Prihodi {amount}',
  'transactions.dayOut': 'Odljevi {amount}',
  'transactions.theAccount': 'račun',
  'transactions.deleteAdjustmentDescription':
    '{amount} na računu {account}, {date}. Stanje se vraća na ono prije. Ovo se ne može poništiti.',
  'transactions.adjustmentDescription':
    'Ispravak stanja računa {account}. Ne broji se kao prihod ni potrošnja.'
}
