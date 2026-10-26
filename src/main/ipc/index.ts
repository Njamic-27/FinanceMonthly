import { registerCategoryHandlers } from './categories'
import { registerSettingsHandlers } from './settings'

export function registerIpcHandlers(): void {
  registerSettingsHandlers()
  registerCategoryHandlers()
}
