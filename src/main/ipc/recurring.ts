import { getDb } from '../db'
import { createRecurringItem, listRecurringItems } from '../db/repositories/recurring'
import { handle } from './handle'

export function registerRecurringHandlers(): void {
  handle('recurring:list', () => listRecurringItems(getDb()))
  handle('recurring:create', (input) => createRecurringItem(getDb(), input))
}
