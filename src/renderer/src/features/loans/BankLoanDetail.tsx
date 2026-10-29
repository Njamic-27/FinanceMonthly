import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Landmark, Pencil } from 'lucide-react'
import { formatDate, today } from '@shared/dates'
import { LOAN_REMINDER_DAYS, type Loan, type LoanInstallment } from '@shared/loans'
import { Button } from '@renderer/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@renderer/components/ui/card'
import { useAccounts } from '@renderer/features/accounts/queries'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { accountPath, dayPath } from '@renderer/lib/links'
import { toast } from '@renderer/lib/toast'
import { cn } from '@renderer/lib/utils'
import { BankLoanDialog } from './BankLoanDialog'
import { nextInstallment } from './installment'
import { LoanProgress } from './LoanProgress'
import { PayInstallmentDialog, type PayInstallmentTarget } from './PayInstallmentDialog'
import { useLoanSchedule, useUnpayInstallment } from './queries'

/** How the installments get paid: by themselves, or by you with a reminder. */
function PaidHow({ loan }: { loan: Loan }): React.JSX.Element | null {
  const account = useAccounts().data?.find((a) => a.id === loan.accountId)
  if (loan.status !== 'active') return null
  return (
    <p className="text-sm text-ink-muted">
      {loan.autoPay ? (
        <>
          Paid automatically
          {account && (
            <>
              {' from '}
              <Link to={accountPath(account.id)} className="link">
                {account.name}
              </Link>
            </>
          )}{' '}
          on each due date.
        </>
      ) : (
        `You mark each installment paid; Financije reminds you ${LOAN_REMINDER_DAYS} days before.`
      )}
    </p>
  )
}

function Overview({ loan }: { loan: Loan }): React.JSX.Element {
  const money = useCurrency()
  const bank = loan.bank
  const percent = new Intl.NumberFormat(money.locale, { maximumFractionDigits: 2 }).format(
    loan.interestRate ?? 0
  )
  return (
    <Card className="grid content-start gap-5">
      <div>
        <p className="text-sm text-ink-muted">
          {loan.status === 'paid_off' ? 'Paid off' : `You owe ${loan.counterparty}`}
        </p>
        <p className="amount text-amount">
          {money.format(loan.status === 'paid_off' ? loan.principal : loan.outstanding)}
        </p>
      </div>
      <LoanProgress loan={loan} />
      {bank && (
        <>
          <dl className="grid grid-cols-3 gap-4 border-t border-line pt-4">
            <div>
              <dt className="text-sm text-ink-muted">Each month</dt>
              <dd className="amount text-lg">{money.format(bank.monthlyPayment)}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">Interest</dt>
              <dd className="text-lg font-semibold">{percent}% a year</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">Paid off in</dt>
              <dd className="text-lg font-semibold">
                <Link to={dayPath(bank.payoffDate)} className="link">
                  {formatDate(bank.payoffDate, money.locale, { month: 'short', year: 'numeric' })}
                </Link>
              </dd>
            </div>
          </dl>
          <dl className="grid grid-cols-3 gap-4">
            <div>
              <dt className="text-sm text-ink-muted">Installments paid</dt>
              <dd className="text-lg font-semibold">
                {bank.paidCount} of {loan.installmentsCount}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">Interest paid</dt>
              <dd className="amount text-lg">{money.format(bank.interestPaid)}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">Interest in total</dt>
              <dd className="amount text-lg">{money.format(bank.totalInterest)}</dd>
            </div>
          </dl>
          {bank.overdueCount > 0 && (
            <p className="text-sm font-semibold text-expense">
              {bank.overdueCount} installment{bank.overdueCount === 1 ? ' is' : 's are'} past due
              and not marked paid.
            </p>
          )}
        </>
      )}
      <PaidHow loan={loan} />
      {loan.note && <p className="text-ink-muted">{loan.note}</p>}
    </Card>
  )
}

function Schedule({
  loan,
  onPay
}: {
  loan: Loan
  onPay: (target: PayInstallmentTarget) => void
}): React.JSX.Element {
  const money = useCurrency()
  const schedule = useLoanSchedule(loan.id)
  const unpay = useUnpayInstallment()
  const now = today()
  const rows = schedule.data ?? []
  // Each date opens its day in the Calendar.
  const short = (date: string): React.ReactNode => (
    <Link to={dayPath(date)} className="link">
      {formatDate(date, money.locale, { day: 'numeric', month: 'short', year: 'numeric' })}
    </Link>
  )

  const undo = (row: LoanInstallment): void =>
    unpay.mutate(row.id, {
      onSuccess: () => toast({ title: `Installment ${row.seq} is due again`, variant: 'success' }),
      onError: (error) =>
        toast({ title: 'Not undone', description: error.message, variant: 'error' })
    })

  return (
    <Card className="mt-8">
      <CardHeader>
        <div>
          <CardTitle>Schedule</CardTitle>
          <CardDescription>
            Each payment is part interest on what’s still owed, part principal.
          </CardDescription>
        </div>
      </CardHeader>
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead className="text-left text-ink-muted">
            <tr className="border-b border-line">
              <th scope="col" className="py-2 pr-3 font-semibold">
                #
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                Due
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">
                Payment
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">
                Principal
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">
                Interest
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">
                Still owed
              </th>
              <th scope="col" className="py-2 font-semibold">
                <span className="sr-only">Status</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => {
              const paid = row.transactionId !== null
              const overdue = !paid && row.dueDate < now
              return (
                <tr key={row.id} className={cn(paid && 'text-ink-muted')}>
                  <td className="py-2 pr-3">{row.seq}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{short(row.dueDate)}</td>
                  <td className="amount py-2 pr-3 text-right">{money.format(row.amount)}</td>
                  <td className="amount py-2 pr-3 text-right">{money.format(row.principalPart)}</td>
                  <td className="amount py-2 pr-3 text-right">{money.format(row.interestPart)}</td>
                  <td className="amount py-2 pr-3 text-right">{money.format(row.balance)}</td>
                  <td className="py-1 text-right whitespace-nowrap">
                    {paid ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="text-income">
                          Paid {row.paidDate && short(row.paidDate)}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={unpay.isPending}
                          aria-label={`Undo payment of installment ${row.seq}`}
                          onClick={() => undo(row)}
                        >
                          Undo
                        </Button>
                      </span>
                    ) : (
                      loan.status === 'active' && (
                        <span className="inline-flex items-center gap-2">
                          {overdue && <span className="font-semibold text-expense">Overdue</span>}
                          <Button
                            variant={overdue ? 'secondary' : 'ghost'}
                            size="sm"
                            aria-label={`Pay installment ${row.seq}`}
                            onClick={() =>
                              onPay({
                                installmentId: row.id,
                                title: `${loan.title} (${row.seq}/${loan.installmentsCount ?? row.seq})`,
                                amount: row.amount,
                                dueDate: row.dueDate,
                                accountId: loan.accountId
                              })
                            }
                          >
                            Pay…
                          </Button>
                        </span>
                      )
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/** A bank loan: what's owed, the terms, and the full schedule with each payment. */
export function BankLoanDetail({ loan }: { loan: Loan }): React.JSX.Element {
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [paying, setPaying] = useState<PayInstallmentTarget | null>(null)
  const next = nextInstallment(loan)

  return (
    <>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-loan-soft text-loan">
            <Landmark className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-[2rem] leading-tight font-bold">{loan.title}</h1>
            <p className="mt-1 text-ink-muted">
              Bank loan from {loan.counterparty}
              {loan.status === 'paid_off' && ' · Paid off'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil />
            Edit loan
          </Button>
          {next && <Button onClick={() => setPaying(next)}>Pay next installment</Button>}
        </div>
      </header>

      <Overview loan={loan} />
      <Schedule loan={loan} onPay={setPaying} />

      <BankLoanDialog
        open={editing}
        loan={loan}
        onClose={() => setEditing(false)}
        onDeleted={() => {
          void navigate('/loans')
        }}
      />
      <PayInstallmentDialog target={paying} onClose={() => setPaying(null)} />
    </>
  )
}
