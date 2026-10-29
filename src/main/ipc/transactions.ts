import { getDb } from '../db'
import { updateAdjustment } from '../db/repositories/adjustments'
import {
  createTransaction,
  deleteTransaction,
  getTransaction,
  listTransactions,
  updateTransaction
} from '../db/repositories/transactions'
import { handle } from './handle'

export function registerTransactionHandlers(): void {
  handle('transactions:list', (query) => listTransactions(getDb(), query))
  handle('transactions:get', (id) => getTransaction(getDb(), id))
  handle('transactions:create', (input) => createTransaction(getDb(), input))
  handle('transactions:update', (id, input) => updateTransaction(getDb(), id, input))
  handle('transactions:delete', (id) => deleteTransaction(getDb(), id))
  handle('transactions:updateAdjustment', (id, input) => updateAdjustment(getDb(), id, input))
}
