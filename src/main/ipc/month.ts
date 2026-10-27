import { today } from '@shared/dates'
import { getDb } from '../db'
import { copyFromLastMonth, monthSheet, setMonthCell } from '../services/monthSheet'
import { handle } from './handle'

export function registerMonthHandlers(): void {
  handle('month:sheet', (query) => monthSheet(getDb(), query, today()))
  handle('month:setCell', (input) => setMonthCell(getDb(), input, today()))
  handle('month:copyFromLastMonth', (query) => copyFromLastMonth(getDb(), query, today()))
}
