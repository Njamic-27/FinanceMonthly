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
  listLoanInstallments,
  listLoans,
  listLoanTransactions,
  reopenLoan,
  settleLoan,
  updatePersonalLoan,
  updateRepayment
} from '../db/repositories/loans'
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
  handle('loans:createBank', (input) => createBankLoan(getDb(), input))
  handle('loans:updateBank', (id, input) => updateBankLoan(getDb(), id, input))
  handle('loans:schedule', (id) => listLoanInstallments(getDb(), id))
  handle('loans:payInstallment', (id, input) => payInstallment(getDb(), id, input))
  handle('loans:unpayInstallment', (id) => unpayInstallment(getDb(), id))
}
