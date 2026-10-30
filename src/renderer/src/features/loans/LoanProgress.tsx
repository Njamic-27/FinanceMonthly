import { loanShare, type Loan } from '@shared/loans'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { cn } from '@renderer/lib/utils'
import { t } from '@renderer/lib/i18n'

/** How much of a loan is paid back: a bar in the loan colour and "€100.00 of €300.00 paid back". */
export function LoanProgress({
  loan,
  className
}: {
  loan: Loan
  className?: string
}): React.JSX.Element {
  const money = useCurrency()
  const share = loanShare(loan)
  return (
    <div className={className}>
      <div
        role="progressbar"
        aria-label={t('loans.paidBack')}
        aria-valuemin={0}
        aria-valuemax={loan.principal}
        aria-valuenow={Math.min(loan.repaid, loan.principal)}
        aria-valuetext={`${money.format(loan.repaid)} of ${money.format(loan.principal)}`}
        className="h-2 overflow-hidden rounded-full bg-surface-2"
      >
        <div
          className={cn(
            'h-full rounded-full bg-loan',
            loan.status === 'written_off' && 'opacity-50'
          )}
          style={{ width: `${share * 100}%` }}
        />
      </div>
      <p className="mt-2 text-sm text-ink-muted">
        {t('loans.paidBackOf', {
          repaid: money.format(loan.repaid),
          principal: money.format(loan.principal)
        })}
      </p>
    </div>
  )
}
