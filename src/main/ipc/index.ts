import { registerAccountHandlers } from './accounts'
import { registerCalendarHandlers } from './calendar'
import { registerCategoryHandlers } from './categories'
import { registerRecurringHandlers } from './recurring'
import { registerSettingsHandlers } from './settings'
import { registerStatsHandlers } from './stats'
import { registerTransactionHandlers } from './transactions'

export async function registerIpcHandlers(): Promise<void> {
  registerSettingsHandlers()
  registerCategoryHandlers()
  registerAccountHandlers()
  registerTransactionHandlers()
  registerRecurringHandlers()
  registerStatsHandlers()
  registerCalendarHandlers()

  // Seed and reset exist only in development builds: in production `import.meta.env.DEV` is
  // false at build time, so this branch and the dev module are left out of the bundle.
  if (import.meta.env.DEV) {
    const { registerDevHandlers } = await import('../dev/handlers')
    registerDevHandlers()
  }
}
