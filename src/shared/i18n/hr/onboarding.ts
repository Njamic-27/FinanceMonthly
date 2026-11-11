import type { onboarding as en } from '../en/onboarding'
import type { Translation } from '../types'

export const onboarding: Translation<typeof en> = {
  'onboarding.currencyAndDates': 'Valuta i datumi',
  'onboarding.howAmountsAndDates':
    'Kako izgledaju iznosi i datumi. To možeš kasnije promijeniti u Postavkama.',
  'onboarding.addTheCardsAnd':
    'Dodaj kartice i gotovinu kojima plaćaš, s onim što je danas na svakoj. Svaka transakcija ide s jedne od njih ili na nju.',
  'onboarding.whatYouSortSpending':
    'U što razvrstavaš potrošnju i prihode. Ukloni one koje nećeš koristiti i dodaj svoje; možeš ih mijenjati kad god želiš.',
  'onboarding.salary': 'Plaća',
  'onboarding.salaryOptional': 'Plaća (neobavezno)',
  'onboarding.ifYourePaidA':
    'Ako primaš redovnu mjesečnu plaću, dodaj je ovdje i pojavit će se u tvojim planovima i projekcijama.',
  'onboarding.continue': 'Nastavi',
  'onboarding.noAccountsYetStart': 'Još nema računa. Počni s karticom koju najviše koristiš.',
  'onboarding.addAtLeastOne': 'Dodaj barem jedan račun za nastavak',
  'onboarding.spending': 'Potrošnja',
  'onboarding.remove': 'Ukloni',
  'onboarding.add': 'Dodaj',
  'onboarding.enterYourMonthlyPay': 'Upiši svoju mjesečnu plaću',
  'onboarding.salaryNotAdded': 'Plaća nije dodana',
  'onboarding.monthlyPayAfterTax': 'Mjesečna neto plaća',
  'onboarding.paidOnDay': 'Isplaćuje se dana',
  'onboarding.addSalaryAndFinish': 'Dodaj plaću i završi',
  'onboarding.setupSkipped': 'Postavljanje preskočeno',
  'onboarding.addYourAccountsAny': 'Račune možeš dodati kad god želiš pod Računi.',
  'onboarding.youreAllSet': 'Sve je spremno',
  'onboarding.yourSalaryIsIn': 'Plaća je dodana. Troškove dodaješ s Ctrl+N.',
  'onboarding.addWhatYouSpend': 'Troškove dodaješ s Ctrl+N.',
  'onboarding.setupNotFinished': 'Postavljanje nije završeno',
  'onboarding.financije': 'FinanceMonthly',
  'onboarding.setUpInFour': 'Postavi u četiri kratka koraka.',
  'onboarding.setupSteps': 'Koraci postavljanja',
  'onboarding.skipSetup': 'Preskoči postavljanje',
  'onboarding.sample':
    'Iznosi izgledaju ovako: {amount}, datumi ovako: {date}, a tjedni traju od {from} do {to}.',
  'onboarding.removeName': 'Ukloni: {name}',
  'onboarding.removed': 'Uklonjeno: {name}',
  'onboarding.notRemoved': 'Nije uklonjeno: {name}',
  'onboarding.nextExpected': 'Sljedeća se očekuje {date}{shortMonths}.',
  'onboarding.shortMonths': ' — u kraćim mjesecima zadnjeg dana',
  'onboarding.stepOf': 'Korak {step} od {total}'
}
