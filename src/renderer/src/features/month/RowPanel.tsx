import { useState } from 'react'
import { Link } from 'react-router'
import { ChevronRight, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react'
import type { Account } from '@shared/accounts'
import { formatDate, today, type IsoDate } from '@shared/dates'
import { monthRange, summaryDate, type MonthKey, type MonthSheetRow } from '@shared/month'
import { goalShare } from '@shared/savings'
import type { DayTotal, Transaction } from '@shared/transactions'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { useLoans, useUnpayInstallment } from '@renderer/features/loans/queries'
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
import { useClearMonthRow, useHideMonthRow, useMonthRowTransactions } from './queries'

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

/** Asks before something that can't be undone. */
function Confirm({
  open,
  title,
  description,
  action,
  pending,
  onConfirm,
  onCancel
}: {
  open: boolean
  title: string
  description: string
  action: string
  pending: boolean
  onConfirm: () => void
  onCancel: () => void
}): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Keep it
          </Button>
          <Button variant="danger" disabled={pending} onClick={onConfirm}>
            {action}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
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
          Add transaction
        </Button>
        <Button variant="outline" size="sm" onClick={onRename}>
          <Pencil />
          Rename…
        </Button>
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          Colour and icon…
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
                    title: `${category.name} hidden`,
                    description: 'It still shows in months with its transactions.'
                  })
                  onClose()
                }
              }
            )
          }
        >
          <EyeOff />
          Hide from the sheet
        </Button>
        {row.count > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-expense hover:text-expense"
            onClick={() => setClearing(true)}
          >
            <Trash2 />
            Remove this month’s amounts…
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
        title={`Remove ${category.name} for this month?`}
        description={`${row.count === 1 ? 'Its transaction' : `All ${row.count} of its transactions`} counted this month (${money.format(row.actual)}) will be deleted, the amount typed on the sheet included. Payments from recurring items and installments stay. This can’t be undone.`}
        action="Remove amounts"
        pending={clear.isPending}
        onCancel={() => setClearing(false)}
        onConfirm={() =>
          clear.mutate(
            { month, kind: 'category', sourceId: category.id },
            {
              onSuccess: (removed) => {
                toast({
                  title:
                    removed === 1 ? '1 transaction removed' : `${removed} transactions removed`,
                  variant: 'success'
                })
                setClearing(false)
              },
              onError: (error) =>
                toast({ title: 'Nothing removed', description: error.message, variant: 'error' })
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
        <Fact label="How often">{describeSchedule(item, money.locale)}</Fact>
        <Fact label="Amount">{money.format(item.amount)}</Fact>
        {account && <Fact label={isIncome ? 'Paid into' : 'Paid with'}>{account.name}</Fact>}
        <Fact label="Next">
          {!item.isActive
            ? 'Paused'
            : formatDate(item.nextDueDate, money.locale, {
                weekday: 'short',
                day: 'numeric',
                month: 'short'
              })}
        </Fact>
        <Fact label="Added">{item.autoPost ? 'By itself on the day' : 'When you confirm it'}</Fact>
      </dl>
      <Actions>
        {due && item.isActive && (
          <Button size="sm" onClick={() => setConfirming({ item, plannedDate: item.nextDueDate })}>
            {isIncome ? 'Mark received…' : 'Mark paid…'}
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Pencil />
          Edit…
        </Button>
        <Button variant="outline" size="sm" onClick={onRename}>
          Rename…
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
                    title: item.isActive ? `${item.title} paused` : `${item.title} resumed`,
                    variant: 'success'
                  })
              }
            )
          }
        >
          {item.isActive ? 'Pause' : 'Resume'}
        </Button>
      </Actions>
      <p className="text-sm text-ink-muted">Edit… also ends or deletes it.</p>
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
          Edit card…
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
        <Fact label="Bought for">{money.format(plan.totalAmount)}</Fact>
        <Fact label="Each month">{money.format(plan.installment)}</Fact>
        <Fact label="Charged">
          {plan.postedCount} of {plan.count}
        </Fact>
        <Fact label="Still to come">{money.format(plan.remaining)}</Fact>
        <Fact label={plan.nextDate ? 'Next' : 'Last'}>{short(plan.nextDate ?? plan.lastDate)}</Fact>
      </dl>
      <Actions>
        <Button
          variant="ghost"
          size="sm"
          className="text-expense hover:text-expense"
          onClick={() => setDeleting(true)}
        >
          <Trash2 />
          Delete purchase…
        </Button>
      </Actions>
      <Confirm
        open={deleting}
        title={`Delete “${plan.title}”?`}
        description={
          plan.postedCount > 0
            ? `Its ${plan.postedCount} charged installment${plan.postedCount === 1 ? '' : 's'} (${money.format(plan.totalAmount - plan.remaining)}) are removed too, as if you never bought it. This can’t be undone.`
            : 'Nothing has been charged for it yet. This can’t be undone.'
        }
        action="Delete purchase"
        pending={remove.isPending}
        onCancel={() => setDeleting(false)}
        onConfirm={() =>
          remove.mutate(plan.id, {
            onSuccess: () => {
              toast({ title: `${plan.title} deleted`, variant: 'success' })
              setDeleting(false)
              onClose()
            },
            onError: (error) =>
              toast({ title: 'Not deleted', description: error.message, variant: 'error' })
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
          <Fact label="Next installment">
            {money.format(next.amount)} ·{' '}
            {formatDate(next.dueDate, money.locale, { day: 'numeric', month: 'short' })}
          </Fact>
        )}
        {!isBank && loan.dueDate && (
          <Fact label="Expected back">{formatDate(loan.dueDate, money.locale)}</Fact>
        )}
      </dl>
      <LoanProgress loan={loan} />
      <Actions>
        {next && (
          <Button size="sm" onClick={() => setPaying(next)}>
            Pay next installment…
          </Button>
        )}
        {!isBank && loan.status === 'active' && (
          <Button size="sm" onClick={() => setRepaying({ kind: 'new', loan })}>
            Record repayment…
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Pencil />
          Edit loan…
        </Button>
      </Actions>
      <p className="text-sm text-ink-muted">Edit loan… also deletes it.</p>
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
          label={`${Math.floor(share * 100)}% of ${money.format(goal.targetAmount)} saved`}
        />
        <div>
          <p className="amount text-title">{money.format(goal.saved)}</p>
          <p className="text-sm text-ink-muted">of {money.format(goal.targetAmount)}</p>
        </div>
      </div>
      <p className="text-sm text-ink-muted">{goalOutlook(goal, today(), money)}</p>
      <Actions>
        <Button size="sm" onClick={() => setMoving({ kind: 'new', goal, type: 'deposit' })}>
          Put in…
        </Button>
        {goal.saved > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMoving({ kind: 'new', goal, type: 'withdrawal' })}
          >
            Take out…
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Pencil />
          Edit goal…
        </Button>
        <Button variant="ghost" size="sm" onClick={onRename}>
          Rename…
        </Button>
      </Actions>
      <p className="text-sm text-ink-muted">Edit goal… also archives or deletes it.</p>
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
  const loans = useLoans().data ?? []
  const goals = useSavingsGoals().data ?? []
  const list = useMonthRowTransactions(row && { month, kind: row.kind, sourceId: row.sourceId })
  const transactions = list.data ?? []
  const unpay = useUnpayInstallment()
  const [movement, setMovement] = useState<MovementDialogTarget | null>(null)
  const [repayment, setRepayment] = useState<RepaymentDialogTarget | null>(null)
  const [undoing, setUndoing] = useState<Transaction | null>(null)

  const dayTotals = new Map<IsoDate, DayTotal>()
  for (const tx of transactions) {
    const day = dayTotals.get(tx.date) ?? { date: tx.date, income: 0, expenses: 0 }
    if (tx.type === 'income') day.income += tx.amount
    if (tx.type === 'expense') day.expenses += tx.amount
    dayTotals.set(tx.date, day)
  }

  /** Savings and loan movements open in their own dialogs, right here. */
  const openOwned = (tx: Transaction): void => {
    const goal = goals.find((g) => g.id === tx.savingsGoalId)
    if (goal) {
      setMovement({ kind: 'edit', goal, movement: tx })
      return
    }
    const loan = loans.find((l) => l.id === tx.loanId)
    if (!loan) return
    if (loan.kind !== 'bank_loan') setRepayment({ kind: 'edit', loan, repayment: tx })
    else if (tx.loanInstallmentId !== null) setUndoing(tx)
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
                {monthLabel} · {money.format(Math.abs(row.actual))} recorded
                {row.planned !== 0 && ` · ${money.format(Math.abs(row.planned))} planned`}
                {row.summary !== 0 && `, ${money.format(row.summary)} of it typed on the sheet`}
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
                {transactions.length === 1
                  ? '1 transaction this month'
                  : `${transactions.length} transactions this month`}
              </h3>
              {list.isError ? (
                <p className="text-sm text-expense">{list.error.message}</p>
              ) : transactions.length > 0 ? (
                <TransactionList
                  transactions={transactions}
                  dayTotals={dayTotals}
                  accounts={accounts}
                  categories={categories}
                  onOpenOwned={openOwned}
                />
              ) : (
                !list.isPending && (
                  <p className="rounded-panel border border-dashed border-line p-5 text-center text-sm text-ink-muted">
                    Nothing recorded here this month.
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
                Open full page
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            )}
          </div>
        )}
        <MovementDialog target={movement} onClose={() => setMovement(null)} />
        <RepaymentDialog target={repayment} onClose={() => setRepayment(null)} />
        <Confirm
          open={undoing !== null}
          title="Undo this installment payment?"
          description="The payment is deleted and the installment is due again."
          action="Undo payment"
          pending={unpay.isPending}
          onCancel={() => setUndoing(null)}
          onConfirm={() => {
            if (undoing?.loanInstallmentId == null) return
            unpay.mutate(undoing.loanInstallmentId, {
              onSuccess: () => {
                toast({ title: 'Payment undone', variant: 'success' })
                setUndoing(null)
              },
              onError: (error) =>
                toast({ title: 'Not undone', description: error.message, variant: 'error' })
            })
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
