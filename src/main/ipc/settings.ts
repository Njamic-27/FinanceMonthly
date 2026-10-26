import { nativeTheme } from 'electron'
import { getDb } from '../db'
import { getSettings, updateSettings } from '../db/repositories/settings'
import { handle } from './handle'

export function registerSettingsHandlers(): void {
  handle('settings:get', () => getSettings(getDb()))

  handle('settings:update', (patch) => {
    const settings = updateSettings(getDb(), patch)
    // The theme is applied app-wide by main; the renderer follows prefers-color-scheme.
    nativeTheme.themeSource = settings.theme
    return settings
  })
}
