import { getDb } from '../db'
import {
  createTransaction,
  deleteTransaction,
  getTransaction,
  updateTransaction
} from '../db/repositories/transactions'
import { handle } from './handle'

export function registerTransactionHandlers(): void {
  handle('transactions:get', (id) => getTransaction(getDb(), id))
  handle('transactions:create', (input) => createTransaction(getDb(), input))
  handle('transactions:update', (id, input) => updateTransaction(getDb(), id, input))
  handle('transactions:delete', (id) => deleteTransaction(getDb(), id))
}
