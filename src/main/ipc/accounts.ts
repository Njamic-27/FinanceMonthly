import { z } from 'zod'
import { getDb } from '../db'
import {
  createAccount,
  deleteAccount,
  listAccounts,
  setAccountArchived,
  updateAccount
} from '../db/repositories/accounts'
import { handle } from './handle'

export function registerAccountHandlers(): void {
  handle('accounts:list', () => listAccounts(getDb()))
  handle('accounts:create', (input) => createAccount(getDb(), input))
  handle('accounts:update', (id, input) => updateAccount(getDb(), id, input))
  handle('accounts:archive', (id, archived) =>
    setAccountArchived(getDb(), id, z.boolean().parse(archived))
  )
  handle('accounts:delete', (id) => deleteAccount(getDb(), id))
}
