import type { panel as en } from '../en/panel'
import type { Translation } from '../types'

export const panel: Translation<typeof en> = {
  'panel.colourIcon': 'Boja i ikona…',
  'panel.hiddenHint': 'I dalje se prikazuje u mjesecima sa svojim transakcijama.',
  'panel.removeAmounts': 'Ukloni ovomjesečne iznose…',
  'panel.removeTitle': 'Ukloniti {name} za ovaj mjesec?',
  'panel.removeDescription': {
    one: '{count} transakcija ovog mjeseca ({amount}) bit će obrisana, uključujući iznos upisan na tablici. Plaćanja ponavljajućih stavki i rata ostaju. Ovo se ne može poništiti.',
    few: '{count} transakcije ovog mjeseca ({amount}) bit će obrisane, uključujući iznos upisan na tablici. Plaćanja ponavljajućih stavki i rata ostaju. Ovo se ne može poništiti.',
    other:
      '{count} transakcija ovog mjeseca ({amount}) bit će obrisano, uključujući iznos upisan na tablici. Plaćanja ponavljajućih stavki i rata ostaju. Ovo se ne može poništiti.'
  },
  'panel.removeAction': 'Ukloni iznose',
  'panel.removed': {
    one: 'Uklonjena {count} transakcija',
    few: 'Uklonjene {count} transakcije',
    other: 'Uklonjeno {count} transakcija'
  },
  'panel.nothingRemoved': 'Ništa nije uklonjeno',
  'panel.next': 'Sljedeće',
  'panel.paused': 'Pauzirano',
  'panel.added': 'Dodaje se',
  'panel.addedAuto': 'Samo, na taj dan',
  'panel.addedConfirm': 'Kad potvrdiš',
  'panel.edit': 'Uredi…',
  'panel.pausedToast': 'Pauzirano: {title}',
  'panel.resumedToast': 'Ponovno aktivno: {title}',
  'panel.pause': 'Pauziraj',
  'panel.resume': 'Nastavi',
  'panel.editEnds': 'Pod „Uredi…” možeš ga i završiti ili obrisati.',
  'panel.editCard': 'Uredi karticu…',
  'panel.boughtFor': 'Kupljeno za',
  'panel.eachMonth': 'Svaki mjesec',
  'panel.charged': 'Naplaćeno',
  'panel.chargedOf': '{posted} od {total}',
  'panel.last': 'Zadnja',
  'panel.deletePurchase': 'Obriši kupnju…',
  'panel.deletePurchaseAction': 'Obriši kupnju',
  'panel.deleteTitle': 'Obrisati „{title}”?',
  'panel.deletePlanCharged': {
    one: 'Uklanja se i {count} naplaćena rata ({amount}), kao da je nikad nisi kupio. Ovo se ne može poništiti.',
    few: 'Uklanjaju se i {count} naplaćene rate ({amount}), kao da je nikad nisi kupio. Ovo se ne može poništiti.',
    other:
      'Uklanja se i {count} naplaćenih rata ({amount}), kao da je nikad nisi kupio. Ovo se ne može poništiti.'
  },
  'panel.deletePlanNone': 'Za nju još ništa nije naplaćeno. Ovo se ne može poništiti.',
  'panel.deleted': 'Obrisano: {title}',
  'panel.nextInstallment': 'Sljedeća rata',
  'panel.expectedBack': 'Očekivani povrat',
  'panel.payNext': 'Plati sljedeću ratu…',
  'panel.recordRepayment': 'Upiši povrat…',
  'panel.editLoan': 'Uredi zajam…',
  'panel.editLoanDeletes': 'Pod „Uredi zajam…” možeš ga i obrisati.',
  'panel.savedOf': 'Ušteđeno {percent}% od {target}',
  'panel.of': 'od {amount}',
  'panel.putIn': 'Uplati…',
  'panel.takeOut': 'Podigni…',
  'panel.editGoal': 'Uredi cilj…',
  'panel.editGoalArchives': 'Pod „Uredi cilj…” možeš ga i arhivirati ili obrisati.',
  'panel.recorded': '{amount} zabilježeno',
  'panel.typedPart': ', od toga {amount} upisano na tablici',
  'panel.transactionsThisMonth': {
    one: '{count} transakcija ovaj mjesec',
    few: '{count} transakcije ovaj mjesec',
    other: '{count} transakcija ovaj mjesec'
  },
  'panel.nothingRecorded': 'Ovaj mjesec ovdje ništa nije zabilježeno.',
  'panel.openFullPage': 'Otvori cijelu stranicu',

  'rename.category': 'Ovo preimenuje kategoriju posvuda, uključujući njezine prošle transakcije.',
  'rename.recurring':
    'Ovo preimenuje ponavljajuće plaćanje; već zabilježene transakcije zadržavaju svoj naslov.',
  'rename.savings': 'Ovo preimenuje cilj štednje.',
  'rename.done': 'Preimenovano u {name}',
  'rename.title': 'Preimenuj „{title}”',
  'rename.action': 'Preimenuj',

  'confirm.keep': 'Zadrži',
  'owned.undoTitle': 'Poništiti ovu uplatu rate?',
  'owned.undoDescription': 'Uplata se briše i rata ponovno dospijeva.',
  'owned.undoAction': 'Poništi uplatu',
  'owned.undone': 'Uplata poništena',
  'owned.notUndone': 'Nije poništeno'
}
