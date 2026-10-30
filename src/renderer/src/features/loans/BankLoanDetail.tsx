import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Landmark, Pencil } from 'lucide-react'
import { formatDate, today } from '@shared/dates'
import { installmentTitle } from '@shared/installments'
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
import { t, tNode } from '@renderer/lib/i18n'

/** How the installments get paid: by themselves, or by you with a reminder. */
function PaidHow({ loan }: { loan: Loan }): React.JSX.Element | null {
  const account = useAccounts().data?.find((a) => a.id === loan.accountId)
  if (loan.status !== 'active') return null
  return (
    <p className="text-sm text-ink-muted">
      {loan.autoPay
        ? account
          ? tNode('loans.paidFromOnDue', {
              account: (
                <Link to={accountPath(account.id)} className="link">
                  {account.name}
                </Link>
              )
            })
          : t('loans.paidOnDue')
        : t('loans.youMark', { days: LOAN_REMINDER_DAYS })}
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
          {loan.status === 'paid_off'
            ? t('accounts.paidOff')
            : t('loans.youOwe', { name: loan.counterparty })}
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
              <dt className="text-sm text-ink-muted">{t('panel.eachMonth')}</dt>
              <dd className="amount text-lg">{money.format(bank.monthlyPayment)}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">{t('loans.interest')}</dt>
              <dd className="text-lg font-semibold">{t('loans.perYear', { percent })}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">{t('loans.paidOffIn')}</dt>
              <dd className="text-lg font-semibold">
                <Link to={dayPath(bank.payoffDate)} className="link">
                  {formatDate(bank.payoffDate, money.locale, { month: 'short', year: 'numeric' })}
                </Link>
              </dd>
            </div>
          </dl>
          <dl className="grid grid-cols-3 gap-4">
            <div>
              <dt className="text-sm text-ink-muted">{t('loans.installmentsPaid')}</dt>
              <dd className="text-lg font-semibold">
                {t('loans.paidOfTotal', {
                  paid: bank.paidCount,
                  total: loan.installmentsCount ?? 0
                })}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">{t('loans.interestPaid')}</dt>
              <dd className="amount text-lg">{money.format(bank.interestPaid)}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">{t('loans.interestInTotal')}</dt>
              <dd className="amount text-lg">{money.format(bank.totalInterest)}</dd>
            </div>
          </dl>
          {bank.overdueCount > 0 && (
            <p className="text-sm font-semibold text-expense">
              {t('loans.pastDue', { count: bank.overdueCount })}
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
      onSuccess: () => toast({ title: t('loans.dueAgain', { seq: row.seq }), variant: 'success' }),
      onError: (error) =>
        toast({ title: t('owned.notUndone'), description: error.message, variant: 'error' })
    })

  return (
    <Card className="mt-8">
      <CardHeader>
        <div>
          <CardTitle>{t('loans.schedule')}</CardTitle>
          <CardDescription>{t('loans.eachPaymentIsPart')}</CardDescription>
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
                {t('month.due')}
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">
                {t('loans.payment')}
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">
                {t('loans.principal')}
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">
                {t('loans.interest')}
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">
                {t('loans.stillOwed')}
              </th>
              <th scope="col" className="py-2 font-semibold">
                <span className="sr-only">{t('loans.status')}</span>
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
                          {tNode('loans.paidOn', { date: row.paidDate ? short(row.paidDate) : '' })}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={unpay.isPending}
                          aria-label={t('loans.undoPaymentOf', { seq: row.seq })}
                          onClick={() => undo(row)}
                        >
                          {t('loans.undo')}
                        </Button>
                      </span>
                    ) : (
                      loan.status === 'active' && (
                        <span className="inline-flex items-center gap-2">
                          {overdue && (
                            <span className="font-semibold text-expense">
                              {t('common.overdue')}
                            </span>
                          )}
                          <Button
                            variant={overdue ? 'secondary' : 'ghost'}
                            size="sm"
                            aria-label={t('loans.payInstallment', { seq: row.seq })}
                            onClick={() =>
                              onPay({
                                installmentId: row.id,
                                title: installmentTitle(
                                  loan.title,
                                  row.seq,
                                  loan.installmentsCount ?? row.seq
                                ),
                                amount: row.amount,
                                dueDate: row.dueDate,
                                accountId: loan.accountId
                              })
                            }
                          >
                            {t('month.pay')}
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
              {t('loans.bankLoanFrom', { bank: loan.counterparty })}
              {loan.status === 'paid_off' && t('loans.paidOffSuffix')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil />
            {t('loans.editLoan')}
          </Button>
          {next && <Button onClick={() => setPaying(next)}>{t('loans.payNextInstallment')}</Button>}
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
