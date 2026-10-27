import type { Loan, LoanKind } from '@shared/loans'

/** "Lent to Marko", "Borrowed from Ana". */
export const loanSummary = (loan: Pick<Loan, 'kind' | 'counterparty'>): string =>
  loan.kind === 'lent' ? `Lent to ${loan.counterparty}` : `Borrowed from ${loan.counterparty}`

/** "Marko owes you" or "You owe Ana": over what's still owed. */
export const owedLabel = (loan: Pick<Loan, 'kind' | 'counterparty'>): string =>
  loan.kind === 'lent' ? `${loan.counterparty} owes you` : `You owe ${loan.counterparty}`

/** The status for people: paid off, written off (let go), or still owed. */
export function statusLabel(loan: Pick<Loan, 'kind' | 'status'>): string | null {
  if (loan.status === 'paid_off') return 'Paid off'
  if (loan.status === 'written_off') return loan.kind === 'lent' ? 'Let go' : 'Let off'
  return null
}

/** Labels that depend on which way the money went. */
export const directionLabels: Record<
  Exclude<LoanKind, 'bank_loan'>,
  { start: string; repayment: string; account: string; repaymentAccount: string }
> = {
  lent: {
    start: 'Lent',
    repayment: 'Paid back to you',
    account: 'Paid from',
    repaymentAccount: 'Into'
  },
  borrowed: {
    start: 'Borrowed',
    repayment: 'You paid back',
    account: 'Received into',
    repaymentAccount: 'From'
  }
}
