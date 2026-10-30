import type { Message } from '../types'

// The window around every screen: the sidebar, Back and the screens' names.
export const shell = {
  'screen.month': 'Month',
  'screen.projections': 'Projections',
  'screen.calendar': 'Calendar',
  'screen.transactions': 'Transactions',
  'screen.overview': 'Overview',
  'screen.history': 'History',
  'screen.accounts': 'Accounts',
  'screen.recurring': 'Recurring',
  'screen.savings': 'Savings',
  'screen.loans': 'Loans',
  'screen.categories': 'Categories',
  'screen.settings': 'Settings',
  'shell.addTransaction': 'Add transaction',
  'shell.addTransactionShortcut': 'Add transaction (Ctrl+N)',
  'shell.dueNow': 'due now',
  'shell.mainNav': 'Main',
  'shell.more': 'More',
  'shell.moreScreens': 'More screens',
  'shell.fewerScreens': 'Fewer screens',
  'shell.uiKit': 'UI kit',
  'shell.expandSidebar': 'Expand sidebar',
  'shell.collapseSidebar': 'Collapse sidebar',
  'shell.collapse': 'Collapse',
  'shell.back': 'Back',
  'shell.backShortcut': 'Back (Alt+Left)'
} satisfies Record<string, Message>
