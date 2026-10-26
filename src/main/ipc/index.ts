import { registerAccountHandlers } from './accounts'
import { registerCategoryHandlers } from './categories'
import { registerSettingsHandlers } from './settings'
import { registerTransactionHandlers } from './transactions'

export function registerIpcHandlers(): void {
  registerSettingsHandlers()
  registerCategoryHandlers()
  registerAccountHandlers()
  registerTransactionHandlers()
}
