import { getDb } from '../db'
import { handle } from '../ipc/handle'
import { resetDevDatabase } from './reset'
import { seedDemoData } from './seed'

/** Only registered in development builds (see registerIpcHandlers). */
export function registerDevHandlers(): void {
  handle('dev:reset', () => resetDevDatabase())
  handle('dev:seed', () => {
    resetDevDatabase()
    return seedDemoData(getDb())
  })
}
