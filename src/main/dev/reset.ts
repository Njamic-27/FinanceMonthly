import { rmSync } from 'fs'
import { basename } from 'path'
import { nativeTheme } from 'electron'
import { closeDatabase, databasePath, getDb, initDatabase } from '../db'
import { getSettings } from '../db/repositories/settings'
import { AppError } from '../errors'

const DEV_DATABASE = 'finance-dev.db'

/** Dev tools refuse to touch anything but the development database. */
export function assertDevDatabase(): void {
  if (basename(databasePath()) !== DEV_DATABASE) {
    throw new AppError('internal', `Dev tools only work on ${DEV_DATABASE}.`)
  }
}

/** Deletes the development database and creates it again: the app is back at its first run. */
export function resetDevDatabase(): void {
  assertDevDatabase()
  const file = databasePath()
  closeDatabase()
  for (const path of [file, `${file}-wal`, `${file}-shm`]) rmSync(path, { force: true })
  initDatabase()
  nativeTheme.themeSource = getSettings(getDb()).theme
}
