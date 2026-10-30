import type { Loan, LoanKind } from '@shared/loans'
import { t } from '@renderer/lib/i18n'

/** "Lent to Marko", "Borrowed from Ana". */
export const loanSummary = (loan: Pick<Loan, 'kind' | 'counterparty'>): string =>
  t(loan.kind === 'lent' ? 'loans.lentTo' : 'loans.borrowedFrom', { name: loan.counterparty })

/** "Marko owes you" or "You owe Ana": over what's still owed. */
export const owedLabel = (loan: Pick<Loan, 'kind' | 'counterparty'>): string =>
  t(loan.kind === 'lent' ? 'loans.owesYou' : 'loans.youOwe', { name: loan.counterparty })

/** The status for people: paid off, written off (let go), or still owed. */
export function statusLabel(loan: Pick<Loan, 'kind' | 'status'>): string | null {
  if (loan.status === 'paid_off') return t('accounts.paidOff')
  if (loan.status === 'written_off')
    return loan.kind === 'lent' ? t('loans.letGo') : t('loans.letOff')
  return null
}

/** Labels that depend on which way the money went. */
export const directionLabels = (
  kind: Exclude<LoanKind, 'bank_loan'>
): { start: string; repayment: string; account: string; repaymentAccount: string } =>
  ({
    lent: {
      start: t('loans.lent'),
      repayment: t('loans.paidBackToYou'),
      account: t('accounts.paidFrom'),
      repaymentAccount: t('loans.into')
    },
    borrowed: {
      start: t('loans.borrowed'),
      repayment: t('loans.youPaidBack'),
      account: t('loans.receivedInto'),
      repaymentAccount: t('loans.from')
    }
  })[kind]
