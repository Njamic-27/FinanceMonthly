import { today } from '@shared/dates'
import { getDb } from '../db'
import {
  createBankLoan,
  payInstallment,
  unpayInstallment,
  updateBankLoan
} from '../db/repositories/bankLoans'
import {
  addRepayment,
  createPersonalLoan,
  deleteLoan,
  deleteRepayment,
  getLoan,
  listLoanInstallments,
  listLoans,
  listLoanTransactions,
  reopenLoan,
  settleLoan,
  updatePersonalLoan,
  updateRepayment
} from '../db/repositories/loans'
import { postDueLoanInstallments } from '../services/posting'
import { handle } from './handle'

export function registerLoanHandlers(): void {
  handle('loans:list', () => listLoans(getDb()))
  handle('loans:create', (input) => createPersonalLoan(getDb(), input))
  handle('loans:update', (id, input) => updatePersonalLoan(getDb(), id, input))
  handle('loans:delete', (id) => deleteLoan(getDb(), id))
  handle('loans:transactions', (id) => listLoanTransactions(getDb(), id))
  handle('loans:addRepayment', (input) => addRepayment(getDb(), input))
  handle('loans:updateRepayment', (id, input) => updateRepayment(getDb(), id, input))
  handle('loans:deleteRepayment', (id) => deleteRepayment(getDb(), id))
  handle('loans:settle', (id, input) => settleLoan(getDb(), id, input))
  handle('loans:reopen', (id) => reopenLoan(getDb(), id))
  // A loan paying automatically pays what's already due straight away.
  handle('loans:createBank', (input) => {
    const db = getDb()
    const loan = createBankLoan(db, input)
    postDueLoanInstallments(db, today())
    return getLoan(db, loan.id)
  })
  handle('loans:updateBank', (id, input) => {
    const db = getDb()
    updateBankLoan(db, id, input)
    postDueLoanInstallments(db, today())
    return getLoan(db, id)
  })
  handle('loans:schedule', (id) => listLoanInstallments(getDb(), id))
  handle('loans:payInstallment', (id, input) => payInstallment(getDb(), id, input))
  handle('loans:unpayInstallment', (id) => unpayInstallment(getDb(), id))
}
