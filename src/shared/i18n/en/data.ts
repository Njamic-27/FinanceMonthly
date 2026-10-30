import type { Message } from '../types'

export const data = {
  'data.balanceAdjustment': 'Balance adjustment',
  'data.cashWithdrawal': 'Cash withdrawal',
  'data.cashDeposit': 'Cash deposit',
  'data.transferTo': 'Transfer to {name}',
  'data.loanTo': 'Loan to {name}',
  'data.loanFrom': 'Loan from {name}',
  'data.paidBackBy': '{name} paid back',
  'data.paidBackTo': 'Paid back {name}'
} satisfies Record<string, Message>
