import { useState } from 'react'
import { Link } from 'react-router'
import { ChevronRight, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react'
import type { Account } from '@shared/accounts'
import { formatDate, today, type IsoDate } from '@shared/dates'
import { monthRange, summaryDate, type MonthKey, type MonthSheetRow } from '@shared/month'
import { goalShare } from '@shared/savings'
import type { DayTotal } from '@shared/transactions'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { AccountDialog } from '@renderer/features/accounts/AccountDialog'
import { CardOverview } from '@renderer/features/accounts/CardOverview'
import { useAccounts, useCardStatus } from '@renderer/features/accounts/queries'
import { CategoryDialog } from '@renderer/features/categories/CategoryDialog'
import { useCategories } from '@renderer/features/categories/queries'
import { InstallmentPlans } from '@renderer/features/installments/InstallmentPlans'
import {
  useDeleteInstallmentPlan,
  useInstallmentPlans
} from '@renderer/features/installments/queries'
import { BankLoanDialog } from '@renderer/features/loans/BankLoanDialog'
import { nextInstallment } from '@renderer/features/loans/installment'
import { LoanDialog } from '@renderer/features/loans/LoanDialog'
import { LoanProgress } from '@renderer/features/loans/LoanProgress'
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
import {
  ConfirmPaymentDialog,
  type ConfirmPaymentTarget
} from '@renderer/features/recurring/ConfirmPaymentDialog'
import { useRecurringItems, useSetRecurringActive } from '@renderer/features/recurring/queries'
import { RecurringDialog } from '@renderer/features/recurring/RecurringDialog'
import { describeSchedule } from '@renderer/features/recurring/schedule'
import { GoalDialog } from '@renderer/features/savings/GoalDialog'
import {
  MovementDialog,
  type MovementDialogTarget
} from '@renderer/features/savings/MovementDialog'
import { goalOutlook } from '@renderer/features/savings/outlook'
import { ProgressRing } from '@renderer/features/savings/ProgressRing'
import { useSavingsGoals } from '@renderer/features/savings/queries'
import { openTransactionDialog } from '@renderer/features/transactions/dialogStore'
import { TransactionList } from '@renderer/features/transactions/TransactionList'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { accountPath, categoryPath, goalPath, loanPath, recurringPath } from '@renderer/lib/links'
import { toast } from '@renderer/lib/toast'
import { Confirm } from './Confirm'
import { useOwnedEditor } from './useOwnedEditor'
import { useClearMonthRow, useHideMonthRow, useMonthRowTransactions } from './queries'
import { t } from '@renderer/lib/i18n'

/** Where the thing behind a row has its own page, a secondary way to see more. */
function rowPage(row: MonthSheetRow, month: MonthKey): string | null {
  switch (row.kind) {
    case 'category':
      return categoryPath(row.sourceId, monthRange(month))
    case 'recurring':
      return recurringPath(row.sourceId)
    case 'card_payment':
      return accountPath(row.sourceId)
    case 'installment_plan':
      return row.accountId === null ? null : accountPath(row.accountId)
    case 'loan':
      return loanPath(row.sourceId)
    case 'savings':
      return goalPath(row.sourceId)
  }
}

/** A small "label: value" line in a row's details. */
function Fact({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right font-semibold">{children}</dd>
    </div>
  )
}

function Actions({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className="flex flex-wrap gap-2">{children}</div>
}

function CategoryDetails({
  row,
  month,
  onRename,
  onClose
}: {
  row: MonthSheetRow
  month: MonthKey
  onRename: () => void
  onClose: () => void
}): React.JSX.Element | null {
  const money = useCurrency()
  const categories = useCategories().data ?? []
  const category = categories.find((c) => c.id === row.sourceId)
  const [editing, setEditing] = useState(false)
  const [clearing, setClearing] = useState(false)
  const hide = useHideMonthRow()
  const clear = useClearMonthRow()
  if (!category) return null

  return (
    <>
      <Actions>
        <Button
          size="sm"
          onClick={() =>
            openTransactionDialog({
              kind: 'new',
              prefill: {
                type: category.type,
                categoryId: category.id,
                accountId: row.accountId ?? undefined,
                date: summaryDate(month, today())
              }
            })
          }
        >
          <Plus />
          {t('shell.addTransaction')}
        </Button>
        <Button variant="outline" size="sm" onClick={onRename}>
          <Pencil />
          {t('month.rename')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          {t('panel.colourIcon')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            hide.mutate(
              { categoryId: category.id, hidden: true },
              {
                onSuccess: () => {
                  toast({
                    title: t('month.hidden', { title: category.name }),
                    description: t('panel.hiddenHint')
                  })
                  onClose()
                }
              }
            )
          }
        >
          <EyeOff />
          {t('month.hideRow')}
        </Button>
        {row.count > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-expense hover:text-expense"
            onClick={() => setClearing(true)}
          >
            <Trash2 />
            {t('panel.removeAmounts')}
          </Button>
        )}
      </Actions>
      <CategoryDialog
        target={editing ? { kind: 'edit', category } : null}
        categories={categories}
        onClose={() => setEditing(false)}
      />
      <Confirm
        open={clearing}
        title={t('panel.removeTitle', { name: category.name })}
        description={t('panel.removeDescription', {
          count: row.count,
          amount: money.format(row.actual)
        })}
        action={t('panel.removeAction')}
        pending={clear.isPending}
        onCancel={() => setClearing(false)}
        onConfirm={() =>
          clear.mutate(
            { month, kind: 'category', sourceId: category.id },
            {
              onSuccess: (removed) => {
                toast({
                  title: t('panel.removed', { count: removed }),
                  variant: 'success'
                })
                setClearing(false)
              },
              onError: (error) =>
                toast({
                  title: t('panel.nothingRemoved'),
                  description: error.message,
                  variant: 'error'
                })
            }
          )
        }
      />
    </>
  )
}

function RecurringDetails({
  row,
  month,
  accounts,
  onRename
}: {
  row: MonthSheetRow
  month: MonthKey
  accounts: Account[]
  onRename: () => void
}): React.JSX.Element | null {
  const money = useCurrency()
  const item = (useRecurringItems().data ?? []).find((i) => i.id === row.sourceId)
  const setActive = useSetRecurringActive()
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState<ConfirmPaymentTarget | null>(null)
  if (!item) return null
  const account = accounts.find((a) => a.id === item.accountId)
  const isIncome = item.kind === 'income'
  // The payment still to settle this month (or overdue before it), if there is one.
  const due = row.planned !== 0 && item.nextDueDate <= monthRange(month).end

  return (
    <>
      <dl className="divide-y divide-line">
        <Fact label={t('line.howOften')}>{describeSchedule(item, money.locale)}</Fact>
        <Fact label={t('common.amount')}>{money.format(item.amount)}</Fact>
        {account && (
          <Fact label={t(isIncome ? 'line.paidInto' : 'line.paidWith')}>{account.name}</Fact>
        )}
        <Fact label={t('panel.next')}>
          {!item.isActive
            ? t('panel.paused')
            : formatDate(item.nextDueDate, money.locale, {
                weekday: 'short',
                day: 'numeric',
                month: 'short'
              })}
        </Fact>
        <Fact label={t('panel.added')}>
          {item.autoPost ? t('panel.addedAuto') : t('panel.addedConfirm')}
        </Fact>
      </dl>
      <Actions>
        {due && item.isActive && (
          <Button size="sm" onClick={() => setConfirming({ item, plannedDate: item.nextDueDate })}>
            {t(isIncome ? 'month.markReceived' : 'month.markPaid')}
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Pencil />
          {t('panel.edit')}
        </Button>
        <Button variant="outline" size="sm" onClick={onRename}>
          {t('month.rename')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={setActive.isPending}
          onClick={() =>
            setActive.mutate(
              { id: item.id, active: !item.isActive },
              {
                onSuccess: () =>
                  toast({
                    title: t(item.isActive ? 'panel.pausedToast' : 'panel.resumedToast', {
                      title: item.title
                    }),
                    variant: 'success'
                  })
              }
            )
          }
        >
          {item.isActive ? t('panel.pause') : t('panel.resume')}
        </Button>
      </Actions>
      <p className="text-sm text-ink-muted">{t('panel.editEnds')}</p>
      <RecurringDialog
        target={editing ? { kind: 'edit', item } : null}
        onClose={() => setEditing(false)}
      />
      <ConfirmPaymentDialog target={confirming} onClose={() => setConfirming(null)} />
    </>
  )
}

function CardDetails({
  row,
  accounts
}: {
  row: MonthSheetRow
  accounts: Account[]
}): React.JSX.Element | null {
  const card = accounts.find((a) => a.id === row.sourceId)
  const status = useCardStatus(row.sourceId).data
  const [editing, setEditing] = useState(false)
  if (!card || !status) return null
  return (
    <>
      <CardOverview
        account={card}
        status={status}
        payFrom={accounts.find((a) => a.type !== 'credit' && !a.isArchived)}
        onEdit={() => setEditing(true)}
      />
      <Actions>
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Pencil />
          {t('panel.editCard')}
        </Button>
      </Actions>
      <InstallmentPlans accountId={card.id} />
      <AccountDialog
        target={editing ? { kind: 'edit', account: card } : null}
        accounts={accounts}
        onClose={() => setEditing(false)}
      />
    </>
  )
}

function PlanDetails({
  row,
  onClose
}: {
  row: MonthSheetRow
  onClose: () => void
}): React.JSX.Element | null {
  const money = useCurrency()
  const plan = (useInstallmentPlans(row.accountId ?? 0).data ?? []).find(
    (p) => p.id === row.sourceId
  )
  const remove = useDeleteInstallmentPlan()
  const [deleting, setDeleting] = useState(false)
  if (!plan) return null
  const short = (date: IsoDate): string =>
    formatDate(date, money.locale, { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <>
      <dl className="divide-y divide-line">
        <Fact label={t('panel.boughtFor')}>{money.format(plan.totalAmount)}</Fact>
        <Fact label={t('panel.eachMonth')}>{money.format(plan.installment)}</Fact>
        <Fact label={t('panel.charged')}>
          {t('panel.chargedOf', { posted: plan.postedCount, total: plan.count })}
        </Fact>
        <Fact label={t('month.stillToCome')}>{money.format(plan.remaining)}</Fact>
        <Fact label={plan.nextDate ? t('panel.next') : t('panel.last')}>
          {short(plan.nextDate ?? plan.lastDate)}
        </Fact>
      </dl>
      <Actions>
        <Button
          variant="ghost"
          size="sm"
          className="text-expense hover:text-expense"
          onClick={() => setDeleting(true)}
        >
          <Trash2 />
          {t('panel.deletePurchase')}
        </Button>
      </Actions>
      <Confirm
        open={deleting}
        title={t('panel.deleteTitle', { title: plan.title })}
        description={
          plan.postedCount > 0
            ? t('panel.deletePlanCharged', {
                count: plan.postedCount,
                amount: money.format(plan.totalAmount - plan.remaining)
              })
            : t('panel.deletePlanNone')
        }
        action={t('panel.deletePurchaseAction')}
        pending={remove.isPending}
        onCancel={() => setDeleting(false)}
        onConfirm={() =>
          remove.mutate(plan.id, {
            onSuccess: () => {
              toast({ title: t('panel.deleted', { title: plan.title }), variant: 'success' })
              setDeleting(false)
              onClose()
            },
            onError: (error) =>
              toast({ title: t('common.notDeleted'), description: error.message, variant: 'error' })
          })
        }
      />
    </>
  )
}

function LoanDetails({
  row,
  onClose
}: {
  row: MonthSheetRow
  onClose: () => void
}): React.JSX.Element | null {
  const money = useCurrency()
  const loan = (useLoans().data ?? []).find((l) => l.id === row.sourceId)
  const [editing, setEditing] = useState(false)
  const [paying, setPaying] = useState<PayInstallmentTarget | null>(null)
  const [repaying, setRepaying] = useState<RepaymentDialogTarget | null>(null)
  if (!loan) return null
  const isBank = loan.kind === 'bank_loan'
  const next = isBank ? nextInstallment(loan) : null
  const status = statusLabel(loan)

  return (
    <>
      <dl className="divide-y divide-line">
        <Fact label={status ?? owedLabel(loan)}>{money.format(loan.outstanding)}</Fact>
        {next && (
          <Fact label={t('panel.nextInstallment')}>
            {money.format(next.amount)} ·{' '}
            {formatDate(next.dueDate, money.locale, { day: 'numeric', month: 'short' })}
          </Fact>
        )}
        {!isBank && loan.dueDate && (
          <Fact label={t('panel.expectedBack')}>{formatDate(loan.dueDate, money.locale)}</Fact>
        )}
      </dl>
      <LoanProgress loan={loan} />
      <Actions>
        {next && (
          <Button size="sm" onClick={() => setPaying(next)}>
            {t('panel.payNext')}
          </Button>
        )}
        {!isBank && loan.status === 'active' && (
          <Button size="sm" onClick={() => setRepaying({ kind: 'new', loan })}>
            {t('panel.recordRepayment')}
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Pencil />
          {t('panel.editLoan')}
        </Button>
      </Actions>
      <p className="text-sm text-ink-muted">{t('panel.editLoanDeletes')}</p>
      {isBank ? (
        <BankLoanDialog
          open={editing}
          loan={loan}
          onClose={() => setEditing(false)}
          onDeleted={onClose}
        />
      ) : (
        <LoanDialog
          target={editing ? { kind: 'edit', loan } : null}
          onClose={() => setEditing(false)}
          onDeleted={onClose}
        />
      )}
      <PayInstallmentDialog target={paying} onClose={() => setPaying(null)} />
      <RepaymentDialog target={repaying} onClose={() => setRepaying(null)} />
    </>
  )
}

function SavingsDetails({
  row,
  onRename,
  onClose
}: {
  row: MonthSheetRow
  onRename: () => void
  onClose: () => void
}): React.JSX.Element | null {
  const money = useCurrency()
  const goals = useSavingsGoals().data ?? []
  const goal = goals.find((g) => g.id === row.sourceId)
  const [editing, setEditing] = useState(false)
  const [moving, setMoving] = useState<MovementDialogTarget | null>(null)
  if (!goal) return null
  const share = goalShare(goal)

  return (
    <>
      <div className="flex items-center gap-4">
        <ProgressRing
          share={share}
          size={64}
          label={t('panel.savedOf', {
            percent: Math.floor(share * 100),
            target: money.format(goal.targetAmount)
          })}
        />
        <div>
          <p className="amount text-title">{money.format(goal.saved)}</p>
          <p className="text-sm text-ink-muted">
            {t('panel.of', { amount: money.format(goal.targetAmount) })}
          </p>
        </div>
      </div>
      <p className="text-sm text-ink-muted">{goalOutlook(goal, today(), money)}</p>
      <Actions>
        <Button size="sm" onClick={() => setMoving({ kind: 'new', goal, type: 'deposit' })}>
          {t('panel.putIn')}
        </Button>
        {goal.saved > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMoving({ kind: 'new', goal, type: 'withdrawal' })}
          >
            {t('panel.takeOut')}
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Pencil />
          {t('panel.editGoal')}
        </Button>
        <Button variant="ghost" size="sm" onClick={onRename}>
          {t('month.rename')}
        </Button>
      </Actions>
      <p className="text-sm text-ink-muted">{t('panel.editGoalArchives')}</p>
      <GoalDialog
        target={editing ? { kind: 'edit', goal } : null}
        goals={goals}
        onClose={() => setEditing(false)}
        onDeleted={onClose}
      />
      <MovementDialog target={moving} onClose={() => setMoving(null)} />
    </>
  )
}

/**
 * A row's details in a side panel: what it is, what you can do with it, and its transactions
 * this month, each opening to edit or delete. Everything happens here, on Month; the row's
 * own page is only an extra link.
 */
export function RowPanel({
  month,
  row,
  onClose,
  onRename
}: {
  month: MonthKey
  row: MonthSheetRow | null
  onClose: () => void
  onRename: (row: MonthSheetRow) => void
}): React.JSX.Element {
  const money = useCurrency()
  const accounts = useAccounts().data ?? []
  const categories = useCategories().data ?? []
  const list = useMonthRowTransactions(row && { month, kind: row.kind, sourceId: row.sourceId })
  const transactions = list.data ?? []
  const owned = useOwnedEditor()

  const dayTotals = new Map<IsoDate, DayTotal>()
  for (const tx of transactions) {
    const day = dayTotals.get(tx.date) ?? { date: tx.date, income: 0, expenses: 0 }
    if (tx.type === 'income') day.income += tx.amount
    if (tx.type === 'expense') day.expenses += tx.amount
    dayTotals.set(tx.date, day)
  }

  const page = row && rowPage(row, month)
  const monthLabel = formatDate(monthRange(month).start, money.locale, {
    month: 'long',
    year: 'numeric'
  })
  const rename = (): void => {
    if (row) onRename(row)
  }

  return (
    <Dialog open={row !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent side>
        {row && (
          <div className="grid gap-5">
            <DialogHeader className="mb-0">
              <DialogTitle>{row.title}</DialogTitle>
              <DialogDescription>
                {monthLabel} · {t('panel.recorded', { amount: money.format(Math.abs(row.actual)) })}
                {row.planned !== 0 &&
                  ` · ${t('month.plannedAmount', { amount: money.format(Math.abs(row.planned)) })}`}
                {row.summary !== 0 && t('panel.typedPart', { amount: money.format(row.summary) })}
              </DialogDescription>
            </DialogHeader>

            {row.kind === 'category' && (
              <CategoryDetails row={row} month={month} onRename={rename} onClose={onClose} />
            )}
            {row.kind === 'recurring' && (
              <RecurringDetails row={row} month={month} accounts={accounts} onRename={rename} />
            )}
            {row.kind === 'card_payment' && <CardDetails row={row} accounts={accounts} />}
            {row.kind === 'installment_plan' && <PlanDetails row={row} onClose={onClose} />}
            {row.kind === 'loan' && <LoanDetails row={row} onClose={onClose} />}
            {row.kind === 'savings' && (
              <SavingsDetails row={row} onRename={rename} onClose={onClose} />
            )}

            <section aria-labelledby="row-panel-transactions" className="grid gap-3">
              <h3 id="row-panel-transactions" className="font-semibold">
                {t('panel.transactionsThisMonth', { count: transactions.length })}
              </h3>
              {list.isError ? (
                <p className="text-sm text-expense">{list.error.message}</p>
              ) : transactions.length > 0 ? (
                <TransactionList
                  transactions={transactions}
                  dayTotals={dayTotals}
                  accounts={accounts}
                  categories={categories}
                  onOpenOwned={owned.open}
                />
              ) : (
                !list.isPending && (
                  <p className="rounded-panel border border-dashed border-line p-5 text-center text-sm text-ink-muted">
                    {t('panel.nothingRecorded')}
                  </p>
                )
              )}
            </section>

            {page && (
              <Link
                to={page}
                onClick={onClose}
                className="link inline-flex items-center gap-1 justify-self-start pb-6 text-sm font-semibold text-ink-muted"
              >
                {t('panel.openFullPage')}
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            )}
          </div>
        )}
        {owned.dialogs}
      </DialogContent>
    </Dialog>
  )
}
