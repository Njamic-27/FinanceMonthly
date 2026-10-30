import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronRight, HandCoins, Landmark, Plus } from 'lucide-react'
import { formatDate, today } from '@shared/dates'
import { isOverdue, type Loan, type LoanKind } from '@shared/loans'
import { PageHeader } from '@renderer/components/PageHeader'
import { Button } from '@renderer/components/ui/button'
import { Card, CardDescription, CardTitle } from '@renderer/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import { BankLoanDialog } from '@renderer/features/loans/BankLoanDialog'
import { LoanDialog, type LoanDialogTarget } from '@renderer/features/loans/LoanDialog'
import { LoanProgress } from '@renderer/features/loans/LoanProgress'
import { nextInstallment } from '@renderer/features/loans/installment'
import {
  PayInstallmentDialog,
  type PayInstallmentTarget
} from '@renderer/features/loans/PayInstallmentDialog'
import { useLoans } from '@renderer/features/loans/queries'
import {
  RepaymentDialog,
  type RepaymentDialogTarget
} from '@renderer/features/loans/RepaymentDialog'
import { owedLabel, statusLabel } from '@renderer/features/loans/wording'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { loanPath } from '@renderer/lib/links'
import { cn } from '@renderer/lib/utils'
import { t } from '@renderer/lib/i18n'

const tabs = (): { kind: LoanKind; label: string; empty: string; add: string }[] => [
  {
    kind: 'lent',
    label: t('loans.lent'),
    empty: t('loans.nothingLentWhenYou'),
    add: t('loans.addMoneyLent')
  },
  {
    kind: 'borrowed',
    label: t('loans.borrowed'),
    empty: t('loans.nothingBorrowedMoneyA'),
    add: t('loans.addMoneyBorrowed')
  },
  {
    kind: 'bank_loan',
    label: t('loans.bankLoans'),
    empty: t('loans.noBankLoansAdd'),
    add: t('loans.addBankLoan')
  }
]

function DueLine({ loan }: { loan: Loan }): React.JSX.Element | null {
  const money = useCurrency()
  if (loan.bank) {
    const { next, overdueCount, payoffDate } = loan.bank
    if (!next || loan.status !== 'active') return null
    const short = (date: string): string =>
      formatDate(date, money.locale, { day: 'numeric', month: 'short' })
    return (
      <span className="grid text-sm">
        <span className={cn(overdueCount > 0 ? 'font-semibold text-expense' : 'text-ink-muted')}>
          {overdueCount > 0
            ? t('loans.installmentsOverdue', { count: overdueCount })
            : t('loans.nextOn', { amount: money.format(next.amount), date: short(next.dueDate) })}
        </span>
        <span className="text-ink-muted">
          {t('loans.paidOffInMonth', {
            month: formatDate(payoffDate, money.locale, { month: 'long', year: 'numeric' })
          })}
        </span>
      </span>
    )
  }
  if (!loan.dueDate || loan.status !== 'active') return null
  const date = formatDate(loan.dueDate, money.locale)
  return isOverdue(loan, today()) ? (
    <span className="text-sm font-semibold text-expense">{t('loans.overdueSince', { date })}</span>
  ) : (
    <span className="text-sm text-ink-muted">{t('loans.expectedBackBy', { date })}</span>
  )
}

function LoanCard({
  loan,
  onOpen,
  onRepay
}: {
  loan: Loan
  onOpen: () => void
  onRepay: () => void
}): React.JSX.Element {
  const money = useCurrency()
  const Icon = loan.kind === 'bank_loan' ? Landmark : HandCoins
  return (
    <div className="flex flex-col rounded-panel border border-line bg-surface text-ink transition-colors hover:bg-surface-2">
      <button
        type="button"
        onClick={onOpen}
        className="flex flex-1 cursor-pointer flex-col gap-4 rounded-panel p-5 text-left focus-visible:outline-2 focus-visible:outline-primary"
      >
        <span className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-loan-soft text-loan">
            <Icon className="size-4" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold">{loan.title}</span>
            {loan.kind === 'bank_loan' ? (
              <span className="block truncate text-sm text-ink-muted">{loan.counterparty}</span>
            ) : (
              loan.note && (
                <span className="block truncate text-sm text-ink-muted">{loan.note}</span>
              )
            )}
          </span>
        </span>
        <span>
          <span className="block text-sm text-ink-muted">{owedLabel(loan)}</span>
          <span className="amount block text-title">{money.format(loan.outstanding)}</span>
        </span>
        <LoanProgress loan={loan} />
        <DueLine loan={loan} />
      </button>
      <div className="px-5 pb-5">
        <Button variant="secondary" size="sm" onClick={onRepay}>
          {loan.kind === 'bank_loan' ? t('loans.payNext') : t('loans.recordRepayment')}
        </Button>
      </div>
    </div>
  )
}

/** Money lent and borrowed, and bank loans: what's still owed each way. */
export function LoansPage(): React.JSX.Element {
  const money = useCurrency()
  const navigate = useNavigate()
  const loans = useLoans()
  const [tab, setTab] = useState<LoanKind>('lent')
  const [dialog, setDialog] = useState<LoanDialogTarget | null>(null)
  const [bankOpen, setBankOpen] = useState(false)
  const [repaying, setRepaying] = useState<RepaymentDialogTarget | null>(null)
  const [paying, setPaying] = useState<PayInstallmentTarget | null>(null)
  const all = loans.data ?? []
  const active = (kind: LoanKind): Loan[] =>
    all.filter((l) => l.kind === kind && l.status === 'active')
  const owed = (kind: LoanKind): number => active(kind).reduce((sum, l) => sum + l.outstanding, 0)
  const addLoan = (kind: LoanKind): void => {
    if (kind === 'bank_loan') setBankOpen(true)
    else setDialog({ kind: 'new', loanKind: kind })
  }
  const repay = (loan: Loan): void => {
    if (loan.kind === 'bank_loan') setPaying(nextInstallment(loan))
    else setRepaying({ kind: 'new', loan })
  }
  const open = (loan: Loan): void => {
    void navigate(loanPath(loan.id))
  }
  const current = tabs().find((x) => x.kind === tab) ?? tabs()[0]

  return (
    <>
      <PageHeader
        title={t('group.loans')}
        description={t('loans.moneyYouLentMoney')}
        actions={
          <Button onClick={() => addLoan(tab)}>
            <Plus />
            {current.add}
          </Button>
        }
      />

      {loans.isError && (
        <Card className="max-w-3xl">
          <CardTitle>{t('loans.loansCouldNotBe')}</CardTitle>
          <CardDescription className="mt-1">
            {t('common.restart', { error: loans.error.message })}
          </CardDescription>
        </Card>
      )}

      {loans.isSuccess && (
        <>
          <Card className="mb-6 flex flex-wrap gap-x-12 gap-y-3">
            <div>
              <p className="text-sm text-ink-muted">{t('loans.owedToYou')}</p>
              <p className="amount text-amount">{money.format(owed('lent'))}</p>
            </div>
            <div>
              <p className="text-sm text-ink-muted">{t('loans.youOwePeople')}</p>
              <p className="amount text-amount">{money.format(owed('borrowed'))}</p>
            </div>
            <div>
              <p className="text-sm text-ink-muted">{t('loans.youOweBanks')}</p>
              <p className="amount text-amount">{money.format(owed('bank_loan'))}</p>
            </div>
            <p className="w-full text-sm text-ink-muted">{t('loans.loansArentCountedAs')}</p>
          </Card>

          <Tabs value={tab} onValueChange={(value) => setTab(value as LoanKind)}>
            <TabsList aria-label={t('loans.kindOfLoan')}>
              {tabs().map(({ kind, label }) => (
                <TabsTrigger key={kind} value={kind}>
                  {label}
                  <span className="text-ink-muted tabular-nums">{active(kind).length || ''}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            {tabs().map(({ kind, empty, add }) => {
              const running = active(kind)
              const closed = all.filter((l) => l.kind === kind && l.status !== 'active')
              return (
                <TabsContent key={kind} value={kind} className="grid gap-8">
                  {running.length > 0 ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {running.map((loan) => (
                        <LoanCard
                          key={loan.id}
                          loan={loan}
                          onOpen={() => open(loan)}
                          onRepay={() => repay(loan)}
                        />
                      ))}
                    </div>
                  ) : (
                    <section className="flex max-w-2xl flex-col items-start gap-4 rounded-panel border border-dashed border-line p-8">
                      <p className="text-ink-muted">{empty}</p>
                      <Button onClick={() => addLoan(kind)}>
                        <Plus />
                        {add}
                      </Button>
                    </section>
                  )}

                  {closed.length > 0 && (
                    <section className="max-w-3xl">
                      <h2 className="mb-1 text-lg font-semibold">{t('loans.closed')}</h2>
                      <p className="mb-3 text-sm text-ink-muted">{t('loans.paidOffOrLet')}</p>
                      <Card className="p-3">
                        <ul className="divide-y divide-line">
                          {closed.map((loan) => (
                            <li key={loan.id} className="py-1 first:pt-0 last:pb-0">
                              <button
                                type="button"
                                onClick={() => open(loan)}
                                className="group flex w-full cursor-pointer items-center gap-3 rounded-control px-2 py-2 text-left link-row"
                              >
                                <span className="min-w-0 flex-1 truncate font-semibold">
                                  {loan.title}
                                </span>
                                <span
                                  className={cn(
                                    'text-sm',
                                    loan.status === 'paid_off' ? 'text-income' : 'text-ink-muted'
                                  )}
                                >
                                  {statusLabel(loan)}
                                </span>
                                <span className="amount text-sm text-ink-muted">
                                  {money.format(loan.principal)}
                                </span>
                                <ChevronRight
                                  className="size-4 text-ink-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                                  aria-hidden
                                />
                              </button>
                            </li>
                          ))}
                        </ul>
                      </Card>
                    </section>
                  )}
                </TabsContent>
              )
            })}
          </Tabs>
        </>
      )}

      <LoanDialog target={dialog} onClose={() => setDialog(null)} />
      <RepaymentDialog target={repaying} onClose={() => setRepaying(null)} />
      <BankLoanDialog open={bankOpen} loan={null} onClose={() => setBankOpen(false)} />
      <PayInstallmentDialog target={paying} onClose={() => setPaying(null)} />
    </>
  )
}
