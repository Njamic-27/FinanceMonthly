import type { Message } from '../types'

// A Month row's side panel, renaming a row and the confirmations it asks for.
export const panel = {
  'panel.colourIcon': 'Colour and icon…',
  'panel.hiddenHint': 'It still shows in months with its transactions.',
  'panel.removeAmounts': 'Remove this month’s amounts…',
  'panel.removeTitle': 'Remove {name} for this month?',
  'panel.removeDescription': {
    one: 'Its transaction counted this month ({amount}) will be deleted, the amount typed on the sheet included. Payments from recurring items and installments stay. This can’t be undone.',
    other:
      'All {count} of its transactions counted this month ({amount}) will be deleted, the amount typed on the sheet included. Payments from recurring items and installments stay. This can’t be undone.'
  },
  'panel.removeAction': 'Remove amounts',
  'panel.removed': { one: '{count} transaction removed', other: '{count} transactions removed' },
  'panel.nothingRemoved': 'Nothing removed',
  'panel.next': 'Next',
  'panel.paused': 'Paused',
  'panel.added': 'Added',
  'panel.addedAuto': 'By itself on the day',
  'panel.addedConfirm': 'When you confirm it',
  'panel.edit': 'Edit…',
  'panel.pausedToast': '{title} paused',
  'panel.resumedToast': '{title} resumed',
  'panel.pause': 'Pause',
  'panel.resume': 'Resume',
  'panel.editEnds': 'Edit… also ends or deletes it.',
  'panel.editCard': 'Edit card…',
  'panel.boughtFor': 'Bought for',
  'panel.eachMonth': 'Each month',
  'panel.charged': 'Charged',
  'panel.chargedOf': '{posted} of {total}',
  'panel.last': 'Last',
  'panel.deletePurchase': 'Delete purchase…',
  'panel.deletePurchaseAction': 'Delete purchase',
  'panel.deleteTitle': 'Delete “{title}”?',
  'panel.deletePlanCharged': {
    one: 'Its {count} charged installment ({amount}) is removed too, as if you never bought it. This can’t be undone.',
    other:
      'Its {count} charged installments ({amount}) are removed too, as if you never bought it. This can’t be undone.'
  },
  'panel.deletePlanNone': 'Nothing has been charged for it yet. This can’t be undone.',
  'panel.deleted': '{title} deleted',
  'panel.nextInstallment': 'Next installment',
  'panel.expectedBack': 'Expected back',
  'panel.payNext': 'Pay next installment…',
  'panel.recordRepayment': 'Record repayment…',
  'panel.editLoan': 'Edit loan…',
  'panel.editLoanDeletes': 'Edit loan… also deletes it.',
  'panel.savedOf': '{percent}% of {target} saved',
  'panel.of': 'of {amount}',
  'panel.putIn': 'Put in…',
  'panel.takeOut': 'Take out…',
  'panel.editGoal': 'Edit goal…',
  'panel.editGoalArchives': 'Edit goal… also archives or deletes it.',
  'panel.recorded': '{amount} recorded',
  'panel.typedPart': ', {amount} of it typed on the sheet',
  'panel.transactionsThisMonth': {
    one: '{count} transaction this month',
    other: '{count} transactions this month'
  },
  'panel.nothingRecorded': 'Nothing recorded here this month.',
  'panel.openFullPage': 'Open full page',

  'rename.category': 'This renames the category everywhere, its past transactions included.',
  'rename.recurring':
    'This renames the recurring payment; transactions already recorded keep their title.',
  'rename.savings': 'This renames the savings goal.',
  'rename.done': 'Renamed to {name}',
  'rename.title': 'Rename “{title}”',
  'rename.action': 'Rename',

  'confirm.keep': 'Keep it',
  'owned.undoTitle': 'Undo this installment payment?',
  'owned.undoDescription': 'The payment is deleted and the installment is due again.',
  'owned.undoAction': 'Undo payment',
  'owned.undone': 'Payment undone',
  'owned.notUndone': 'Not undone'
} satisfies Record<string, Message>
