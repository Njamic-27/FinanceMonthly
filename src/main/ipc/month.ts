import { today } from '@shared/dates'
import { getDb } from '../db'
import {
  clearMonthRow,
  copyFromLastMonth,
  moneyOutItems,
  monthRowTransactions,
  monthSheet,
  setMonthCell,
  setMonthRowAccount
} from '../services/monthSheet'
import {
  addMonthLine,
  hideMonthRow,
  renameMonthRow,
  reorderMonthRows
} from '../services/monthLines'
import { handle } from './handle'

export function registerMonthHandlers(): void {
  handle('month:sheet', (query) => monthSheet(getDb(), query, today()))
  handle('month:setCell', (input) => setMonthCell(getDb(), input, today()))
  handle('month:copyFromLastMonth', (query) => copyFromLastMonth(getDb(), query, today()))
  handle('month:rowTransactions', (query) => monthRowTransactions(getDb(), query))
  handle('month:setRowAccount', (input) => setMonthRowAccount(getDb(), input, today()))
  handle('month:addLine', (input) => addMonthLine(getDb(), input, today()))
  handle('month:renameRow', (input) => renameMonthRow(getDb(), input))
  handle('month:hideRow', (input) => hideMonthRow(getDb(), input, today()))
  handle('month:reorderRows', (input) => reorderMonthRows(getDb(), input, today()))
  handle('month:clearRow', (input) => clearMonthRow(getDb(), input))
  handle('month:moneyOutItems', (query) => moneyOutItems(getDb(), query, today()))
}
