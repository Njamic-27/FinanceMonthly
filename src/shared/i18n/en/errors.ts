import type { Message } from '../types'

export const errors = {
  'errors.accountGone': 'That account no longer exists.',
  'errors.choosePayFrom': 'Choose the account the card’s bill is paid from',
  'errors.payFromNotCard': 'A card’s bill is paid from a debit account or cash, not another card',
  'errors.notAdjustment': 'That transaction isn’t a balance adjustment.',
  'errors.notBankLoan': 'That isn’t a bank loan.',
  'errors.installmentGone': 'That installment no longer exists.',
  'errors.categoryGone': 'That category no longer exists.',
  'errors.mergeDifferent': 'Choose a different category to merge into.',
  'errors.planGone': 'That installment plan no longer exists.',
  'errors.installmentsOnCard': 'Only purchases on a credit card can be paid in installments.',
  'errors.expenseCategoryActive': 'Choose an expense category that isn’t archived.',
  'errors.loanGone': 'That loan no longer exists.',
  'errors.bankLoanOwnScreen': 'Bank loans are edited from their own screen.',
  'errors.bankLoanByInstallment': 'A bank loan is paid off one installment at a time.',
  'errors.notRepayment': 'That isn’t a loan repayment.',
  'errors.installmentAsScheduled':
    'An installment is paid as scheduled. Undo the payment and pay it again to change it.',
  'errors.nothingToReopen': 'Everything has been paid back, so there’s nothing to reopen.',
  'errors.recurringGone': 'That recurring item no longer exists.',
  'errors.staysIncome':
    'Its past payments were posted as income, so it stays income. Add a new item instead.',
  'errors.staysExpense':
    'Its past payments were posted as expenses, so it stays an expense. Add a new item instead.',
  'errors.goalGone': 'That savings goal no longer exists.',
  'errors.goalStartTooLow':
    'More has been taken out of this goal than that would leave in it. Keep a higher starting amount.',
  'errors.notSavingsMovement': 'That isn’t a savings deposit or withdrawal.',
  'errors.transactionGone': 'That transaction no longer exists.',
  'errors.installmentStaysOnCard': 'Installment payments stay on the card they were bought with.',
  'errors.movementsOwnScreens': 'Savings and loan movements are edited from their own screens.',
  'errors.deleteWholePurchase':
    'This is one installment of a purchase. Delete the whole purchase from the card’s page instead.',
  'errors.invalidInput': 'Invalid input',
  'errors.alreadyExists': 'That already exists.',
  'errors.rejected': 'The data was rejected by the database.',
  'errors.somethingWrong': 'Something went wrong.',
  'errors.addAccountFirst': 'Add an account first.',
  'errors.rowsOwnSection': 'Rows can only move within their own section.',
  'errors.chooseRowAccount': 'Choose an account for this row first.',
  'errors.cardGone': 'That card no longer exists.',
  'errors.repaymentsOnPage': 'Record repayments of this loan on its page.',
  'errors.onlyCategoryRow': 'Only a category row’s amounts can be removed at once.',
  'errors.couldNotOpen': 'FinanceMonthly could not open its data',
  'errors.archived': '“{name}” is archived. Restore it to use it again.',
  'errors.loanStarted': 'The loan started on {date}. Choose that day or later.',
  'errors.cardStartsLater':
    '“{name}” starts on {date}. Choose a later date, or move the card’s starting date.',
  'errors.accountStartsLater':
    '“{name}” starts on {date}. Choose a later date, or move the account’s starting date.',
  'errors.accountExists': 'You already have an account called “{name}”.',
  'errors.staysCard':
    '“{name}” has purchases paid in installments, so it has to stay a credit card.',
  'errors.accountInUse':
    '“{name}” has transactions or plans linked to it. Archive it instead to keep your history.',
  'errors.archivedBalance': '“{name}” is archived. Restore it to correct its balance.',
  'errors.changeStartingBalance': '“{name}” starts on {date}. Change its starting balance instead.',
  'errors.installmentsPaid': {
    one: '{count} installment is paid already, so the amount, rate and dates stay as they are.',
    other: '{count} installments are paid already, so the amount, rate and dates stay as they are.'
  },
  'errors.installmentPaid': 'Installment {seq} is paid already.',
  'errors.categoryInUse':
    '“{name}” is used by {count} transactions, recurring items or installment plans. Archive it or merge it into another category instead.',
  'errors.goalArchived': '“{name}” is archived. Restore it to save into it again.',
  'errors.goalInUse':
    '“{name}” has deposits or withdrawals. Archive it instead to keep your history.',
  'errors.repaidAlready': '{amount} has been paid back already. Enter at least that much.',
  'errors.onlyOwed': 'Only {amount} is still owed.',
  'errors.loanClosed': '“{title}” is already closed.',
  'errors.onSheet': '“{name}” is on the sheet already.',
  'errors.incomeCategoryActive': 'Choose an income category that isn’t archived.',
  'errors.notCard': '“{name}” isn’t a credit card.',
  'errors.calendarUpTo': 'The calendar goes up to {month}.',
  'errors.notDueOn': '“{title}” isn’t due on {date}.',
  'errors.alreadyPosted': 'That “{title}” payment is already posted or skipped.',
  'errors.skipEarlier': 'Skip the earlier “{title}” payments first.',
  'errors.notDueThisMonth': '“{title}” isn’t due this month.',
  'errors.dueTwice':
    '“{title}” falls due more than once this month. Change each payment in its list.',
  'errors.noInstallmentDue': 'No installment of “{title}” is due this month.',
  'errors.archivedIncomeCategory':
    'An archived income category is already called “{name}”. Restore it instead.',
  'errors.archivedExpenseCategory':
    'An archived expense category is already called “{name}”. Restore it instead.',
  'errors.incomeCategoryExists': 'There’s already an income category called “{name}”.',
  'errors.expenseCategoryExists': 'There’s already an expense category called “{name}”.',
  'errors.mergeIncome':
    '“{name}” is an income category, so it can only be merged into another income category.',
  'errors.mergeExpense':
    '“{name}” is an expense category, so it can only be merged into another expense category.',
  'errors.loanPaidOff': '“{title}” is paid off. Reopen it to record more.',
  'errors.loanWrittenOff': '“{title}” is written off. Reopen it to record more.',
  'errors.planIncome': 'This income was posted from a plan, so it stays income.',
  'errors.planExpense': 'This expense was posted from a plan, so it stays an expense.',
  'errors.chooseIncomeCategory': '“{name}” is an expense category. Choose an income category.',
  'errors.chooseExpenseCategory': '“{name}” is an income category. Choose an expense category.',
  'errors.cardStartsBack':
    '“{name}” starts on {date}. Choose a later date, or move the card’s starting date back first.',
  'errors.accountStartsBack':
    '“{name}” starts on {date}. Choose a later date, or move the account’s starting date back first.',
  'errors.staysLent': 'Something has been paid back already, so it stays a loan you lent.',
  'errors.staysBorrowed': 'Something has been paid back already, so it stays a loan you borrowed.',
  'errors.goalOnlyHas': '“{name}” only has {amount} to take out.',
  'errors.goalBelowZero':
    'More has been taken out of “{name}” since. Deleting this {amount} deposit would leave it below zero.',
  'errors.rowHasMore':
    '“{title}” already has {amount} in transactions this month. Enter at least that, or change those transactions.',
  'errors.installmentInFull':
    'Installment {seq} is {amount}, paid in full. Enter that amount to mark it paid, or 0 to undo the payment.',
  'errors.databaseFile': '{error}\n\nDatabase file: {path}',
  'errors.restoreGone': 'That deletion can’t be undone any more.',
  'errors.restoreBlocked':
    'It can’t be put back: its account or category is gone, or its payment was recorded again since.'
} satisfies Record<string, Message>
