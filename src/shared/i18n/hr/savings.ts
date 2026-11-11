import type { savings as en } from '../en/savings'
import type { Translation } from '../types'

export const savings: Translation<typeof en> = {
  'savings.goalSaved': 'Cilj spremljen',
  'savings.nothingHasBeenSaved': 'U njega ništa nije uplaćeno. Ovo se ne može poništiti.',
  'savings.deleteGoal': 'Obriši cilj',
  'savings.editGoal': 'Uredi cilj',
  'savings.somethingYoureSavingTowards':
    'Nešto za što štediš. Novac koji uplatiš skida se s jednog od tvojih računa.',
  'savings.target': 'Cilj',
  'savings.by': 'Do',
  'savings.reachItByA': 'Dosegni ga do datuma',
  'savings.showItWithYour': 'Ponovno ga prikaži s ostalim ciljevima.',
  'savings.reachedItOrGave': 'Dosegnut ili odustao si? Povijest ostaje.',
  'savings.restoreGoal': 'Vrati cilj',
  'savings.archiveGoal': 'Arhiviraj cilj',
  'savings.onlyGoalsWithoutDeposits':
    'Mogu se obrisati samo ciljevi bez uplata ili podizanja. Ovaj umjesto toga arhiviraj.',
  'savings.saveGoal': 'Spremi cilj',
  'savings.addGoal': 'Dodaj cilj',
  'savings.putIn': 'Uplati',
  'savings.takeOut': 'Podigni',
  'savings.deleted': 'Obrisano',
  'savings.putInOrTake': 'Uplati ili podigni',
  'savings.goalReached': 'Cilj dosegnut.',
  'savings.namePlaceholder': 'npr. Ljetovanje',
  'savings.alreadySaved': 'Već ušteđeno',
  'savings.eachMonth': 'Svaki mjesec',
  'savings.amountsHint':
    '„Već ušteđeno” je novac odvojen prije nego što si počeo koristiti FinanceMonthly. „Svaki mjesec” je ono što planiraš uplaćivati, za datum kad ćeš dosegnuti cilj.',
  'savings.putInto': 'Uplaćeno: {goal}',
  'savings.takenOut': 'Podignuto: {goal}',
  'savings.deleteDeposit': 'Obrisati ovu uplatu?',
  'savings.deleteWithdrawal': 'Obrisati ovo podizanje?',
  'savings.deleteMovementDescription':
    '{amount}, {date}. Novac se vraća tamo gdje je bio. Ovo se ne može poništiti.',
  'savings.savedOf': 'Ušteđeno {saved} od {target}.',
  'savings.planReach': 'Uz {amount} mjesečno dosegnut ćeš ga: {month}',
  'savings.planOnly': '{plan}.',
  'savings.planInTime': '{plan}, na vrijeme za {by}.',
  'savings.planLate': '{plan}. Da stigneš do {by}, uplaćuj {amount} mjesečno.',
  'savings.putInToReach': 'Uplaćuj {amount} mjesečno da ga dosegneš do {by}.',
  'savings.toGo': 'Još {amount}.',
  'savings.ofAcross': {
    one: 'od {target} u {count} cilju',
    few: 'od {target} u {count} cilja',
    other: 'od {target} u {count} ciljeva'
  },
  'savings.startedWith': 'Počelo s već ušteđenih {amount}.',
  'savings.goalLabel': 'Cilj štednje',
  'savings.archivedSuffix': ' · Arhivirano',
  'savings.goalsAndHowClose': 'Ciljevi i koliko si im blizu.',
  'savings.savingsCouldNotBe': 'Štednja se nije mogla učitati',
  'savings.saveTowardsSomething': 'Štedi za nešto',
  'savings.aHolidayANew':
    'Odmor, novo računalo ili rezerva. Postavi cilj, uplaćuj s računa i vidi kada ćeš stići.',
  'savings.addYourFirstGoal': 'Dodaj svoj prvi cilj',
  'savings.savedInTotal': 'Ukupno ušteđeno',
  'savings.reachedOrSetAside':
    'Dosegnuti ili ostavljeni. Povijest ostaje, a novac koji je još u njima i dalje se broji.',
  'savings.leftToSave': 'Preostalo za uštedjeti',
  'savings.depositsAndWithdrawals': 'Uplate i podizanja',
  'savings.everythingPutInAnd': 'Sve uplaćeno i podignuto.',
  'savings.nothingPutInYet': 'Još ništa nije uplaćeno.',
  'savings.takenOut2': 'Podignuto',
  'savings.thatGoalNoLonger': 'Taj cilj više ne postoji',
  'savings.backToSavings': 'Natrag na štednju'
}
