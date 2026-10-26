import { today } from '@shared/dates'
import { getDb } from '../db'
import { calendarMonth } from '../services/planned'
import { handle } from './handle'

export function registerCalendarHandlers(): void {
  handle('calendar:month', (query) => calendarMonth(getDb(), query, today()))
}
