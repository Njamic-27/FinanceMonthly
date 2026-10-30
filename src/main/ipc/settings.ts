import { nativeTheme } from 'electron'
import { applySystemSettings } from '../app/shell'
import { runScheduledWork } from '../app/scheduler'
import { getDb } from '../db'
import { setCurrentLanguage } from '@shared/i18n'
import { renameBuiltinCategories } from '../db/repositories/categories'
import { getSettings, updateSettings } from '../db/repositories/settings'
import { handle } from './handle'

export function registerSettingsHandlers(): void {
  handle('settings:get', () => getSettings(getDb()))

  handle('settings:update', (patch) => {
    const db = getDb()
    const settings = updateSettings(db, patch)
    if (patch.language) {
      // Main speaks the new language too, and built-in categories follow (PLAN.md step 55).
      setCurrentLanguage(settings.language)
      renameBuiltinCategories(db, settings.language)
    }
    // The theme is applied app-wide by main; the renderer follows prefers-color-scheme.
    nativeTheme.themeSource = settings.theme
    applySystemSettings(settings)
    // Turning reminders on shows the ones already due straight away.
    if (patch.notificationsEnabled) runScheduledWork()
    return settings
  })
}
