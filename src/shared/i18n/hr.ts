import type { Message } from './types'
import type { MessageKey } from './en'
import { accounts } from './hr/accounts'
import { add } from './hr/add'
import { calendar } from './hr/calendar'
import { categories } from './hr/categories'
import { common } from './hr/common'
import { history } from './hr/history'
import { loans } from './hr/loans'
import { month } from './hr/month'
import { onboarding } from './hr/onboarding'
import { overview } from './hr/overview'
import { panel } from './hr/panel'
import { projections } from './hr/projections'
import { recurring } from './hr/recurring'
import { savings } from './hr/savings'
import { settings } from './hr/settings'
import { shell } from './hr/shell'
import { transactions } from './hr/transactions'
import { ui } from './hr/ui'

// Croatian. Every area is typed against its English file, so a missing text fails the build.

export const hr: Record<MessageKey, Message> = {
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
  ...ui,
  ...onboarding,
  ...projections,
  ...overview,
  ...history
}
