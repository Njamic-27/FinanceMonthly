import type { Loan } from '@shared/loans'
import type { PayInstallmentTarget } from './PayInstallmentDialog'

/** The next installment due on a bank loan, ready to pay. */
export function nextInstallment(loan: Loan): PayInstallmentTarget | null {
  const next = loan.bank?.next
  if (!next || loan.status !== 'active') return null
  return {
    installmentId: next.id,
    title: `${loan.title} (${next.seq}/${loan.installmentsCount ?? next.seq})`,
    amount: next.amount,
    dueDate: next.dueDate,
    accountId: loan.accountId
  }
}
