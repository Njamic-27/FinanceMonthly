import { nativeTheme } from 'electron'
import { applySystemSettings } from '../app/shell'
import { runScheduledWork } from '../app/scheduler'
import { getDb } from '../db'
import { getSettings, updateSettings } from '../db/repositories/settings'
import { handle } from './handle'

export function registerSettingsHandlers(): void {
  handle('settings:get', () => getSettings(getDb()))

  handle('settings:update', (patch) => {
    const settings = updateSettings(getDb(), patch)
    // The theme is applied app-wide by main; the renderer follows prefers-color-scheme.
    nativeTheme.themeSource = settings.theme
    applySystemSettings(settings)
    // Turning reminders on shows the ones already due straight away.
    if (patch.notificationsEnabled) runScheduledWork()
    return settings
  })
}
