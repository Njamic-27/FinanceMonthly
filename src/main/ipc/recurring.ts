import { today } from '@shared/dates'
import { getDb } from '../db'
import {
  createRecurringItem,
  deleteRecurringItem,
  listRecurringItems,
  updateRecurringItem
} from '../db/repositories/recurring'
import { dueOccurrences, postOccurrence, skipOccurrence, syncItem } from '../services/posting'
import { handle } from './handle'

export function registerRecurringHandlers(): void {
  handle('recurring:list', () => listRecurringItems(getDb()))
  // A new or edited item posts what is already due straight away, as it would on next start.
  handle('recurring:create', (input) => {
    const db = getDb()
    return syncItem(db, createRecurringItem(db, input).id, today())
  })
  handle('recurring:update', (id, input) => {
    const db = getDb()
    return syncItem(db, updateRecurringItem(db, id, input).id, today())
  })
  handle('recurring:delete', (id) => deleteRecurringItem(getDb(), id))
  handle('recurring:due', () => dueOccurrences(getDb(), today()))
  handle('recurring:post', (input) => postOccurrence(getDb(), input))
  handle('recurring:skip', (itemId, plannedDate) => skipOccurrence(getDb(), itemId, plannedDate))
}
