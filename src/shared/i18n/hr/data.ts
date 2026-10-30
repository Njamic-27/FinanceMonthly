import type { data as en } from '../en/data'
import type { Translation } from '../types'

export const data: Translation<typeof en> = {
  'data.balanceAdjustment': 'Ispravak stanja',
  'data.cashWithdrawal': 'Podizanje gotovine',
  'data.cashDeposit': 'Polog gotovine',
  'data.transferTo': 'Prijenos na {name}',
  'data.loanTo': 'Zajam: {name}',
  'data.loanFrom': 'Zajam od: {name}',
  'data.paidBackBy': '{name} je vratio',
  'data.paidBackTo': 'Vraćeno: {name}'
}
