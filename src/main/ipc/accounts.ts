import { z } from 'zod'
import { today } from '@shared/dates'
import { getDb } from '../db'
import {
  createAccount,
  deleteAccount,
  getAccountBalanceSeries,
  listAccounts,
  setAccountArchived,
  updateAccount
} from '../db/repositories/accounts'
import { cardStatus } from '../services/cards'
import { handle } from './handle'

export function registerAccountHandlers(): void {
  handle('accounts:list', () => listAccounts(getDb()))
  handle('accounts:create', (input) => createAccount(getDb(), input))
  handle('accounts:update', (id, input) => updateAccount(getDb(), id, input))
  handle('accounts:archive', (id, archived) =>
    setAccountArchived(getDb(), id, z.boolean().parse(archived))
  )
  handle('accounts:delete', (id) => deleteAccount(getDb(), id))
  handle('accounts:card', (id) => cardStatus(getDb(), id, today()))
  handle('accounts:series', (query) => getAccountBalanceSeries(getDb(), query))
}
