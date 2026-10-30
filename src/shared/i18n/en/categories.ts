import type { Message } from '../types'

export const categories = {
  'categories.icon': 'Icon',
  'categories.checkTheName': 'Check the name',
  'categories.categorySaved': 'Category saved',
  'categories.categoryNotSaved': 'Category not saved',
  'categories.categoryNotAdded': 'Category not added',
  'categories.categoriesNotMerged': 'Categories not merged',
  'categories.mergeInto': 'Merge into',
  'categories.mergeCategories': 'Merge categories',
  'categories.categoryNotDeleted': 'Category not deleted',
  'categories.nothingIsFiledUnder':
    'Nothing is filed under it, so no transactions change. This can’t be undone.',
  'categories.deleteCategory': 'Delete category',
  'categories.categoryNotArchived': 'Category not archived',
  'categories.categoryNotRestored': 'Category not restored',
  'categories.editCategory': 'Edit category',
  'categories.notUsedByAny': 'Not used by any transactions yet.',
  'categories.group': 'Group',
  'categories.whereItSitsUnder': 'Where it sits under Money out on Month.',
  'categories.stopOfferingItFor': 'Stop offering it for new transactions. Past ones keep it.',
  'categories.restoreCategory': 'Restore category',
  'categories.archiveCategory': 'Archive category',
  'categories.merge': 'Merge',
  'categories.merge2': 'Merge…',
  'categories.onlyUnusedCategoriesCan':
    'Only unused categories can be deleted. Archive or merge this one instead.',
  'categories.saveCategory': 'Save category',
  'categories.addCategory': 'Add category',
  'categories.chooseACategory': 'Choose a category',
  'categories.merged': '{source} merged into {target}',
  'categories.mergeTitle': 'Merge “{name}”',
  'categories.mergeMoves': {
    one: 'Its {count} transaction and anything else filed under it move to the category you choose. Then “{name}” is removed.',
    other:
      'Its {count} transactions and anything else filed under it move to the category you choose. Then “{name}” is removed.'
  },
  'categories.mergeUnused': 'It isn’t used yet, so merging simply removes “{name}”.',
  'categories.chooseIncome': 'Choose an income category',
  'categories.chooseExpense': 'Choose an expense category',
  'categories.newIncome': 'New income category',
  'categories.newExpense': 'New expense category',
  'categories.usedBy': {
    one: 'Used by {count} transaction. Changes show everywhere it’s used.',
    other: 'Used by {count} transactions. Changes show everywhere it’s used.'
  },
  'categories.sortIncome': 'Sort your income into it when you add transactions.',
  'categories.sortSpending': 'Sort your spending into it when you add transactions.',
  'categories.moveIncome': 'Move everything in it to another income category.',
  'categories.moveExpense': 'Move everything in it to another expense category.',
  'categories.noExpenseCategoriesYet':
    'No expense categories yet. Add one to start sorting your spending.',
  'categories.noIncomeCategoriesYet':
    'No income categories yet. Add one for your salary or other income.',
  'categories.usedByRecurringItems': 'Used by recurring items',
  'categories.notUsedYet': 'Not used yet',
  'categories.whatYouSortIncome': 'What you sort income and spending into.',
  'categories.categoriesCouldNotBe': 'Categories could not be loaded',
  'categories.categoryType': 'Category type',
  'categories.notOfferedForNew': 'Not offered for new transactions. Past transactions keep them.'
} satisfies Record<string, Message>
