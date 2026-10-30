import type { categories as en } from '../en/categories'
import type { Translation } from '../types'

export const categories: Translation<typeof en> = {
  'categories.icon': 'Ikona',
  'categories.checkTheName': 'Provjeri naziv',
  'categories.categorySaved': 'Kategorija spremljena',
  'categories.categoryNotSaved': 'Kategorija nije spremljena',
  'categories.categoryNotAdded': 'Kategorija nije dodana',
  'categories.categoriesNotMerged': 'Kategorije nisu spojene',
  'categories.mergeInto': 'Spoji u',
  'categories.mergeCategories': 'Spoji kategorije',
  'categories.categoryNotDeleted': 'Kategorija nije obrisana',
  'categories.nothingIsFiledUnder':
    'U njoj nema ničega, pa se nijedna transakcija ne mijenja. Ovo se ne može poništiti.',
  'categories.deleteCategory': 'Obriši kategoriju',
  'categories.categoryNotArchived': 'Kategorija nije arhivirana',
  'categories.categoryNotRestored': 'Kategorija nije vraćena',
  'categories.editCategory': 'Uredi kategoriju',
  'categories.notUsedByAny': 'Još je ne koristi nijedna transakcija.',
  'categories.group': 'Grupa',
  'categories.whereItSitsUnder': 'Gdje stoji pod Odljevima na Mjesecu.',
  'categories.stopOfferingItFor': 'Prestani je nuditi za nove transakcije. Prošle je zadržavaju.',
  'categories.restoreCategory': 'Vrati kategoriju',
  'categories.archiveCategory': 'Arhiviraj kategoriju',
  'categories.merge': 'Spoji',
  'categories.merge2': 'Spoji…',
  'categories.onlyUnusedCategoriesCan':
    'Mogu se obrisati samo nekorištene kategorije. Ovu umjesto toga arhiviraj ili spoji.',
  'categories.saveCategory': 'Spremi kategoriju',
  'categories.addCategory': 'Dodaj kategoriju',
  'categories.chooseACategory': 'Odaberi kategoriju',
  'categories.merged': '{source} spojeno u {target}',
  'categories.mergeTitle': 'Spoji „{name}”',
  'categories.mergeMoves': {
    one: 'Njezina {count} transakcija i sve ostalo u njoj prelazi u kategoriju koju odabereš. Zatim se „{name}” uklanja.',
    few: 'Njezine {count} transakcije i sve ostalo u njoj prelaze u kategoriju koju odabereš. Zatim se „{name}” uklanja.',
    other:
      'Njezinih {count} transakcija i sve ostalo u njoj prelazi u kategoriju koju odabereš. Zatim se „{name}” uklanja.'
  },
  'categories.mergeUnused': 'Još se ne koristi, pa spajanje samo uklanja „{name}”.',
  'categories.chooseIncome': 'Odaberi kategoriju prihoda',
  'categories.chooseExpense': 'Odaberi kategoriju troška',
  'categories.newIncome': 'Nova kategorija prihoda',
  'categories.newExpense': 'Nova kategorija troška',
  'categories.usedBy': {
    one: 'Koristi je {count} transakcija. Promjene se vide svugdje gdje se koristi.',
    few: 'Koriste je {count} transakcije. Promjene se vide svugdje gdje se koristi.',
    other: 'Koristi je {count} transakcija. Promjene se vide svugdje gdje se koristi.'
  },
  'categories.sortIncome': 'Razvrstavaj u nju prihode kad dodaješ transakcije.',
  'categories.sortSpending': 'Razvrstavaj u nju potrošnju kad dodaješ transakcije.',
  'categories.moveIncome': 'Premjesti sve iz nje u drugu kategoriju prihoda.',
  'categories.moveExpense': 'Premjesti sve iz nje u drugu kategoriju troška.'
}
