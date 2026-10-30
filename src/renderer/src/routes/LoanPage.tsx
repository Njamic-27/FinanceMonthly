import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowDownLeft, ArrowUpRight, HandCoins, Pencil } from 'lucide-react'
import { formatDate, today } from '@shared/dates'
import { isOverdue, loanTypes, type Loan } from '@shared/loans'
import { Button } from '@renderer/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@renderer/components/ui/card'
import { useAccounts } from '@renderer/features/accounts/queries'
import { BankLoanDetail } from '@renderer/features/loans/BankLoanDetail'
import { LoanDialog, type LoanDialogTarget } from '@renderer/features/loans/LoanDialog'
import { LoanProgress } from '@renderer/features/loans/LoanProgress'
import { useLoans, useLoanTransactions, useReopenLoan } from '@renderer/features/loans/queries'
import {
  RepaymentDialog,
  type RepaymentDialogTarget
} from '@renderer/features/loans/RepaymentDialog'
import { SettleDialog } from '@renderer/features/loans/SettleDialog'
import {
  directionLabels,
  loanSummary,
  owedLabel,
  statusLabel
} from '@renderer/features/loans/wording'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { accountPath, dayPath } from '@renderer/lib/links'
import { toast } from '@renderer/lib/toast'
import { cn } from '@renderer/lib/utils'

function Overview({ loan }: { loan: Loan }): React.JSX.Element {
  const money = useCurrency()
  const overdue = isOverdue(loan, today())
  const status = statusLabel(loan)
  // Still owed; once closed, what was let go, or the whole loan when it was paid off.
  const headline =
    loan.status === 'written_off'
      ? loan.principal - loan.repaid
      : loan.status === 'paid_off'
        ? loan.principal
        : loan.outstanding
  const day = (date: string): React.ReactNode => (
    <Link to={dayPath(date)} className="link">
      {formatDate(date, money.locale, { day: 'numeric', month: 'short', year: 'numeric' })}
    </Link>
  )
  return (
    <Card className="grid content-start gap-5">
      <div>
        <p className="text-sm text-ink-muted">{status ?? owedLabel(loan)}</p>
        <p className="amount text-amount">{money.format(headline)}</p>
      </div>
      <LoanProgress loan={loan} />
      <dl className="grid grid-cols-3 gap-4 border-t border-line pt-4">
        <div>
          <dt className="text-sm text-ink-muted">
            {directionLabels(loan.kind === 'lent' ? 'lent' : 'borrowed').start}
          </dt>
          <dd className="amount text-lg">{money.format(loan.principal)}</dd>
        </div>
        <div>
          <dt className="text-sm text-ink-muted">On</dt>
          <dd className="text-lg font-semibold">{day(loan.startDate)}</dd>
        </div>
        <div>
          <dt className="text-sm text-ink-muted">Expected back</dt>
          <dd className={cn('text-lg font-semibold', overdue && 'text-expense')}>
            {loan.dueDate ? day(loan.dueDate) : '—'}
          </dd>
        </div>
      </dl>
      {overdue && (
        <p className="text-sm font-semibold text-expense">Past the date it was expected back.</p>
      )}
      {loan.note && <p className="text-ink-muted">{loan.note}</p>}
    </Card>
  )
}

function History({
  loan,
  onEdit
}: {
  loan: Loan
  onEdit: (target: RepaymentDialogTarget) => void
}): React.JSX.Element {
  const money = useCurrency()
  const transactions = useLoanTransactions(loan.id)
  const accounts = useAccounts().data ?? []
  const list = transactions.data ?? []
  const { repayment } = loanTypes(loan.kind)

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>History</CardTitle>
          <CardDescription>
            {loan.createDisbursementTx
              ? 'The money moving at the start, then every repayment.'
              : 'Every repayment. The start wasn’t recorded as a transaction.'}
          </CardDescription>
        </div>
      </CardHeader>
      {transactions.isSuccess && list.length === 0 ? (
        <p className="text-sm text-ink-muted">Nothing paid back yet.</p>
      ) : (
        <ul className="divide-y divide-line">
          {list.map((tx) => {
            const isRepayment = tx.type === repayment
            const incoming = tx.type === 'loan_in'
            const account = accounts.find((a) => a.id === tx.accountId)
            const Icon = incoming ? ArrowDownLeft : ArrowUpRight
            const title = <span className="block truncate font-semibold">{tx.title}</span>
            return (
              <li key={tx.id} className="py-1 first:pt-0 last:pb-0">
                <div
                  className={cn(
                    'relative flex items-center gap-3 rounded-control px-2 py-2',
                    isRepayment && 'link-row'
                  )}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-loan-soft text-loan">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    {isRepayment ? (
                      <button
                        type="button"
                        onClick={() => onEdit({ kind: 'edit', loan, repayment: tx })}
                        className="link-cover block w-full text-left"
                      >
                        {title}
                      </button>
                    ) : (
                      // The start changes with the loan itself (Edit loan).
                      title
                    )}
                    <span className="block truncate text-sm text-ink-muted">
                      <Link to={dayPath(tx.date)} className="link">
                        {formatDate(tx.date, money.locale)}
                      </Link>
                      {account && (
                        <>
                          {' · '}
                          <Link to={accountPath(account.id)} className="link">
                            {account.name}
                          </Link>
                        </>
                      )}
                      {tx.note && <span className="italic"> · {tx.note}</span>}
                    </span>
                  </span>
                  <span className={cn('amount shrink-0', incoming && 'text-income')}>
                    {money.format(incoming ? tx.amount : -tx.amount, 'exceptZero')}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

function LoanDetail({ loan }: { loan: Loan }): React.JSX.Element {
  const navigate = useNavigate()
  const [dialog, setDialog] = useState<LoanDialogTarget | null>(null)
  const [repaying, setRepaying] = useState<RepaymentDialogTarget | null>(null)
  const [settling, setSettling] = useState<Loan | null>(null)
  const reopen = useReopenLoan()
  const status = statusLabel(loan)

  return (
    <>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-loan-soft text-loan">
            <HandCoins className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-[2rem] leading-tight font-bold">{loan.title}</h1>
            <p className="mt-1 text-ink-muted">
              {loanSummary(loan)}
              {status && ` · ${status}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setDialog({ kind: 'edit', loan })}>
            <Pencil />
            Edit loan
          </Button>
          {loan.status === 'active' ? (
            <>
              <Button variant="outline" onClick={() => setSettling(loan)}>
                Close loan…
              </Button>
              <Button onClick={() => setRepaying({ kind: 'new', loan })}>Record repayment</Button>
            </>
          ) : (
            loan.principal > loan.repaid && (
              <Button
                variant="outline"
                disabled={reopen.isPending}
                onClick={() =>
                  reopen.mutate(loan.id, {
                    onSuccess: () => toast({ title: `${loan.title} reopened`, variant: 'success' }),
                    onError: (error) =>
                      toast({ title: 'Not reopened', description: error.message, variant: 'error' })
                  })
                }
              >
                Reopen
              </Button>
            )
          )}
        </div>
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Overview loan={loan} />
        </div>
        <div className="lg:col-span-3">
          <History loan={loan} onEdit={setRepaying} />
        </div>
      </div>

      <LoanDialog
        target={dialog}
        onClose={() => setDialog(null)}
        onDeleted={() => {
          void navigate('/loans')
        }}
      />
      <RepaymentDialog target={repaying} onClose={() => setRepaying(null)} />
      <SettleDialog loan={settling} onClose={() => setSettling(null)} />
    </>
  )
}

/** One loan: what's still owed, the dates, and its history. */
export function LoanPage(): React.JSX.Element | null {
  const { id } = useParams()
  const loans = useLoans()
  const loan = loans.data?.find((l) => l.id === Number(id))

  if (loans.isSuccess && !loan) {
    return (
      <Card className="max-w-3xl">
        <CardTitle>That loan no longer exists</CardTitle>
        <CardDescription className="mt-1">
          It may have been deleted.{' '}
          <Link to="/loans" className="link font-semibold text-primary">
            Back to loans
          </Link>
        </CardDescription>
      </Card>
    )
  }
  if (!loan) return null
  return loan.kind === 'bank_loan' ? (
    <BankLoanDetail key={loan.id} loan={loan} />
  ) : (
    <LoanDetail key={loan.id} loan={loan} />
  )
}
