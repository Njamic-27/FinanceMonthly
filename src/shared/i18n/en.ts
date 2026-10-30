import { accounts } from './en/accounts'
import { add } from './en/add'
import { calendar } from './en/calendar'
import { categories } from './en/categories'
import { common } from './en/common'
import { loans } from './en/loans'
import { month } from './en/month'
import { panel } from './en/panel'
import { recurring } from './en/recurring'
import { savings } from './en/savings'
import { settings } from './en/settings'
import { shell } from './en/shell'
import { transactions } from './en/transactions'
import { ui } from './en/ui'

// The English texts, the source every other language follows (PLAN.md step 53). Each area
// keeps its own file in en/; a key is "area.what", e.g. "month.addExpense".

export const en = {
  ...common,
  ...shell,
  ...settings,
  ...month,
  ...add,
  ...panel,
  ...recurring,
  ...accounts,
  ...loans,
  ...savings,
  ...transactions,
  ...categories,
  ...calendar,
  ...ui
}

export type MessageKey = keyof typeof en
