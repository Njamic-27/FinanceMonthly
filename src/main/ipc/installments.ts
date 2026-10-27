import { today } from '@shared/dates'
import { getDb } from '../db'
import {
  createInstallmentPlan,
  deleteInstallmentPlan,
  getInstallmentPlan,
  listInstallmentPlans
} from '../db/repositories/installments'
import { postDueInstallments } from '../services/posting'
import { handle } from './handle'

export function registerInstallmentHandlers(): void {
  handle('installments:list', (accountId) => listInstallmentPlans(getDb(), accountId))
  // The first installment is usually today's: it's charged straight away.
  handle('installments:create', (input) => {
    const db = getDb()
    const plan = createInstallmentPlan(db, input)
    postDueInstallments(db, today())
    return getInstallmentPlan(db, plan.id)
  })
  handle('installments:delete', (id) => deleteInstallmentPlan(getDb(), id))
}
