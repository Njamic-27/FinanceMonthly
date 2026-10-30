import type { Message } from '../types'

export const transactions = {
  'transactions.expense': 'Expense',
  'transactions.transfer': 'Transfer',
  'transactions.moneyYouSpent': 'Money you spent.',
  'transactions.moneyYouReceived': 'Money you received.',
  'transactions.moneyMovedBetweenYour':
    'Money moved between your accounts, like cash from an ATM or a card payment.',
  'transactions.enterTheAmountWithout': 'Enter the amount without a minus sign',
  'transactions.transactionDeleted': 'Transaction deleted',
  'transactions.deleteTransaction': 'Delete transaction',
  'transactions.editTransaction': 'Edit transaction',
  'transactions.swapAccounts': 'Swap accounts',
  'transactions.payItAll': 'Pay it all',
  'transactions.theFirstInstallmentCounts': 'The first installment counts',
  'transactions.counts': 'Counts',
  'transactions.duplicate': 'Duplicate',
  'transactions.saveTransaction': 'Save transaction',
  'transactions.addInInstallments': 'Add in installments',
  'transactions.addAnAccountFirst': 'Add an account first',
  'transactions.everyTransactionIsPaid':
    'Every transaction is paid with or into one of your accounts: a debit card, credit card or cash.',
  'transactions.goToAccounts': 'Go to accounts',
  'transactions.transactionNotFound': 'Transaction not found',
  'transactions.today': 'Today',
  'transactions.yesterday': 'Yesterday',
  'transactions.addedToTheAccount': 'Added to the account',
  'transactions.takenOffTheAccount': 'Taken off the account',
  'transactions.enterAnAmountAbove': 'Enter an amount above zero, like 25 or 12.50',
  'transactions.adjustmentSaved': 'Adjustment saved',
  'transactions.deleteThisAdjustment': 'Delete this adjustment?',
  'transactions.adjustmentDeleted': 'Adjustment deleted',
  'transactions.deleteAdjustment': 'Delete adjustment',
  'transactions.editBalanceAdjustment': 'Edit balance adjustment',
  'transactions.whichWay': 'Which way',
  'transactions.optionalEGWhat': 'Optional, e.g. what the difference was',
  'transactions.saveAdjustment': 'Save adjustment',
  'transactions.addedToast': '{kind} added',
  'transactions.savedToast': '{kind} saved',
  'transactions.inInstallments': {
    one: '{title} in {count} installment',
    other: '{title} in {count} installments'
  },
  'transactions.aMonthFrom': '{amount} a month from {date}',
  'transactions.transferPlaceholder': 'e.g. ATM Ilica',
  'transactions.expensePlaceholder': 'e.g. Lidl weekly shop',
  'transactions.deleteDescription':
    '{amount} on {date}. The account balance changes back. This can’t be undone.',
  'transactions.cardOwes': '{card} owes {amount}.',
  'transactions.countsIn': '{counts} in {month} — {card} bill due {date}',
  'transactions.installmentNote':
    'One installment of a purchase on the card. To remove it, delete the whole purchase from {link}.',
  'transactions.cardsPage': 'the card’s page',
  'transactions.countsInShort': ' · counts in {month}',
  'transactions.duplicateTitle': 'Duplicate “{title}”',
  'transactions.dayIn': 'In {amount}',
  'transactions.dayOut': 'Out {amount}',
  'transactions.theAccount': 'the account',
  'transactions.deleteAdjustmentDescription':
    '{amount} on {account}, {date}. The balance goes back to what it was before. This can’t be undone.',
  'transactions.adjustmentDescription':
    'A correction to {account}’s balance. It isn’t counted as income or spending.'
} satisfies Record<string, Message>
