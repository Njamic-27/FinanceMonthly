import type { Message } from '../types'

export const savings = {
  'savings.goalSaved': 'Goal saved',
  'savings.nothingHasBeenSaved': 'Nothing has been saved into it. This can’t be undone.',
  'savings.deleteGoal': 'Delete goal',
  'savings.editGoal': 'Edit goal',
  'savings.somethingYoureSavingTowards':
    'Something you’re saving towards. Money you put in comes out of one of your accounts.',
  'savings.target': 'Target',
  'savings.by': 'By',
  'savings.reachItByA': 'Reach it by a date',
  'savings.showItWithYour': 'Show it with your other goals again.',
  'savings.reachedItOrGave': 'Reached it or gave up on it? Its history stays.',
  'savings.restoreGoal': 'Restore goal',
  'savings.archiveGoal': 'Archive goal',
  'savings.onlyGoalsWithoutDeposits':
    'Only goals without deposits or withdrawals can be deleted. Archive this one instead.',
  'savings.saveGoal': 'Save goal',
  'savings.addGoal': 'Add goal',
  'savings.putIn': 'Put in',
  'savings.takeOut': 'Take out',
  'savings.deleted': 'Deleted',
  'savings.putInOrTake': 'Put in or take out',
  'savings.goalReached': 'Goal reached.',
  'savings.namePlaceholder': 'e.g. Summer holiday',
  'savings.alreadySaved': 'Already saved',
  'savings.eachMonth': 'Each month',
  'savings.amountsHint':
    '“Already saved” is money set aside before you started using FinanceMonthly. “Each month” is what you plan to put in, for the date you’ll reach the goal.',
  'savings.putInto': 'Put into {goal}',
  'savings.takenOut': 'Taken out of {goal}',
  'savings.deleteDeposit': 'Delete this deposit?',
  'savings.deleteWithdrawal': 'Delete this withdrawal?',
  'savings.deleteMovementDescription':
    '{amount} on {date}. The money goes back to where it was. This can’t be undone.',
  'savings.savedOf': '{saved} saved of {target}.',
  'savings.planReach': 'At {amount} a month you’ll reach it in {month}',
  'savings.planOnly': '{plan}.',
  'savings.planInTime': '{plan}, in time for {by}.',
  'savings.planLate': '{plan}. To make it by {by}, put in {amount} a month.',
  'savings.putInToReach': 'Put in {amount} a month to reach it by {by}.',
  'savings.toGo': '{amount} to go.',
  'savings.goalsAndHowClose': 'Goals and how close you are.',
  'savings.savingsCouldNotBe': 'Savings could not be loaded',
  'savings.saveTowardsSomething': 'Save towards something',
  'savings.aHolidayANew':
    'A holiday, a new laptop or a safety cushion. Set a target, put money in from your accounts, and see when you’ll get there.',
  'savings.addYourFirstGoal': 'Add your first goal',
  'savings.savedInTotal': 'Saved in total',
  'savings.reachedOrSetAside':
    'Reached or set aside. Their history stays, and money still in them still counts.',
  'savings.leftToSave': 'Left to save',
  'savings.depositsAndWithdrawals': 'Deposits and withdrawals',
  'savings.everythingPutInAnd': 'Everything put in and taken out.',
  'savings.nothingPutInYet': 'Nothing put in yet.',
  'savings.takenOut2': 'Taken out',
  'savings.thatGoalNoLonger': 'That goal no longer exists',
  'savings.backToSavings': 'Back to savings',
  'savings.ofAcross': {
    one: 'of {target} across {count} goal',
    other: 'of {target} across {count} goals'
  },
  'savings.startedWith': 'Started with {amount} already saved.',
  'savings.goalLabel': 'Savings goal',
  'savings.archivedSuffix': ' · Archived'
} satisfies Record<string, Message>
