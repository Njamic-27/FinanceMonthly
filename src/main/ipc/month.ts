import { today } from '@shared/dates'
import { getDb } from '../db'
import {
  copyFromLastMonth,
  monthRowTransactions,
  monthSheet,
  setMonthCell,
  setMonthRowAccount
} from '../services/monthSheet'
import { handle } from './handle'

export function registerMonthHandlers(): void {
  handle('month:sheet', (query) => monthSheet(getDb(), query, today()))
  handle('month:setCell', (input) => setMonthCell(getDb(), input, today()))
  handle('month:copyFromLastMonth', (query) => copyFromLastMonth(getDb(), query, today()))
  handle('month:rowTransactions', (query) => monthRowTransactions(getDb(), query))
  handle('month:setRowAccount', (input) => setMonthRowAccount(getDb(), input, today()))
}
