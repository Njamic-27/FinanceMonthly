import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Copy,
  Wallet,
  type LucideIcon
} from 'lucide-react'
import type { Account } from '@shared/accounts'
import type { Category } from '@shared/categories'
import { countedDate } from '@shared/cards'
import { formatDate, today, type IsoDate } from '@shared/dates'
import { decimalSeparator } from '@shared/money'
import {
  defaultTransferTitle,
  transactionInputSchema,
  type EditableType,
  type Transaction
} from '@shared/transactions'
import { AmountInput } from '@renderer/components/AmountInput'
import { DatePicker } from '@renderer/components/DatePicker'
import { installmentPlanInputSchema, type InstallmentPlan } from '@shared/installments'
import { isAdjustment } from '@shared/adjustments'
import { FieldError } from '@renderer/components/FieldError'
import { FormError } from '@renderer/components/FormError'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { SegmentedControl } from '@renderer/components/ui/segmented-control'
import { Textarea } from '@renderer/components/ui/textarea'
import { AccountSelect } from '@renderer/features/accounts/AccountSelect'
import { useAccounts } from '@renderer/features/accounts/queries'
import { CategorySelect } from '@renderer/features/categories/CategorySelect'
import { parseCount } from '@renderer/features/installments/count'
import { InstallmentsField } from '@renderer/features/installments/InstallmentsField'
import { useCreateInstallmentPlan } from '@renderer/features/installments/queries'
import { useCategories } from '@renderer/features/categories/queries'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { accountPath } from '@renderer/lib/links'
import { errorProps, fieldErrors } from '@renderer/lib/forms'
import { toast } from '@renderer/lib/toast'
import {
  closeTransactionDialog,
  duplicateTransaction,
  useTransactionDialogTarget,
  type TransactionDialogTarget,
  type TransactionPrefill
} from './dialogStore'
import { countsInMonth } from './countsIn'
import { AdjustmentForm } from './AdjustmentForm'
import {
  useCreateTransaction,
  useDeleteTransaction,
  useTransaction,
  useUpdateTransaction
} from './queries'

type Kind = EditableType
type Field =
  'amount' | 'title' | 'categoryId' | 'accountId' | 'toAccountId' | 'date' | 'note' | 'count'

const kindOptions: { value: Kind; label: string; icon: LucideIcon }[] = [
  { value: 'expense', label: 'Expense', icon: ArrowUpRight },
  { value: 'income', label: 'Income', icon: ArrowDownLeft },
  { value: 'transfer', label: 'Transfer', icon: ArrowLeftRight }
]

const kindNames: Record<Kind, string> = {
  expense: 'Expense',
  income: 'Income',
  transfer: 'Transfer'
}
const kindDescriptions: Record<Kind, string> = {
  expense: 'Money you spent.',
  income: 'Money you received.',
  transfer: 'Money moved between your accounts, like cash from an ATM or a card payment.'
}

/** The account used last, so a run of entries doesn't need it picked each time. */
let lastAccountId: number | null = null

function defaultAccountId(accounts: Account[], prefill?: TransactionPrefill): string {
  const usable = accounts.filter((a) => !a.isArchived)
  const preferred = [prefill?.accountId, lastAccountId].find((id) =>
    usable.some((a) => a.id === id)
  )
  return String(preferred ?? usable.find((a) => a.type !== 'credit')?.id ?? usable[0]?.id ?? '')
}

interface FormProps {
  accounts: Account[]
  categories: Category[]
  existing: Transaction | null
  prefill?: TransactionPrefill
}

function TransactionForm({
  accounts,
  categories,
  existing,
  prefill
}: FormProps): React.JSX.Element {
  const money = useCurrency()

  const [kind, setKind] = useState<Kind>(
    existing?.type === 'income' || existing?.type === 'expense' || existing?.type === 'transfer'
      ? existing.type
      : (prefill?.type ?? 'expense')
  )
  const [amount, setAmount] = useState(() => {
    const cents = existing?.amount ?? prefill?.amount
    return cents === undefined ? '' : money.toInput(cents)
  })
  const [title, setTitle] = useState(existing?.title ?? prefill?.title ?? '')
  const [categoryId, setCategoryId] = useState(
    (existing?.categoryId ?? prefill?.categoryId)?.toString() ?? ''
  )
  const [accountId, setAccountId] = useState(
    existing ? String(existing.accountId) : defaultAccountId(accounts, prefill)
  )
  const [toAccountId, setToAccountId] = useState(
    (existing?.toAccountId ?? prefill?.toAccountId)?.toString() ?? ''
  )
  const [date, setDate] = useState<IsoDate>(existing?.date ?? prefill?.date ?? today())
  const [note, setNote] = useState(existing?.note ?? prefill?.note ?? '')
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [inInstallments, setInInstallments] = useState(prefill?.inInstallments ?? false)
  const [count, setCount] = useState('3')

  const createTransaction = useCreateTransaction()
  const updateTransaction = useUpdateTransaction()
  const deleteTransaction = useDeleteTransaction()
  const createPlan = useCreateInstallmentPlan()
  const pending =
    createTransaction.isPending ||
    updateTransaction.isPending ||
    deleteTransaction.isPending ||
    createPlan.isPending

  // Archived ones stay listed only when this transaction already uses them.
  const accountOptions = accounts.filter(
    (a) => !a.isArchived || a.id === existing?.accountId || a.id === existing?.toAccountId
  )
  const categoryOptions = categories.filter(
    (c) => c.type === kind && (!c.isArchived || c.id === existing?.categoryId)
  )
  const account = accounts.find((a) => String(a.id) === accountId)
  const toAccount =
    kind === 'transfer' ? accounts.find((a) => String(a.id) === toAccountId) : undefined
  const category = categories.find((c) => String(c.id) === categoryId)
  // A purchase on a card counts when its bill is due (PLAN.md step 42): say when.
  const countsOn = account && kind !== 'transfer' ? countedDate(date, account) : date
  const countsIn = countsInMonth(date, countsOn, money.locale)
  // Every account the transaction touches must already be open on its date.
  const opening = [account, toAccount]
    .filter((a): a is Account => !!a)
    .reduce<Account | undefined>(
      (latest, a) => (!latest || a.openingDate > latest.openingDate ? a : latest),
      undefined
    )
  const owedOnCard = toAccount?.type === 'credit' ? Math.max(0, -toAccount.balance) : 0
  // A new purchase on a credit card can be split into installments.
  const canSplit = !existing && kind === 'expense' && account?.type === 'credit'
  const splitting = canSplit && inInstallments
  // An installment already charged belongs to its purchase: it's deleted with the whole plan.
  const isInstallment = existing?.installmentPlanId != null

  const clearError = (field: Field): void => {
    setErrors((current) => ({ ...current, [field]: undefined }))
    setFormError(null)
  }

  const changeKind = (next: Kind): void => {
    setKind(next)
    // A category belongs to one kind; keep it only if it still fits.
    if (category && category.type !== next) setCategoryId('')
    clearError('categoryId')
    clearError('toAccountId')
  }

  const changeAccount = (value: string): void => {
    setAccountId(value)
    if (value === toAccountId) setToAccountId('')
    clearError('accountId')
    clearError('date')
  }

  const swapAccounts = (): void => {
    setAccountId(toAccountId)
    setToAccountId(accountId)
    clearError('accountId')
    clearError('toAccountId')
  }

  const submit = (event: React.FormEvent): void => {
    event.preventDefault()
    let found: Partial<Record<Field, string>> = {}

    const cents = money.parse(amount)
    if (amount.trim() === '') found.amount = 'Enter the amount'
    else if (cents === null) found.amount = `Enter an amount like ${money.toInput(1250)}`
    else if (cents < 0) found.amount = 'Enter the amount without a minus sign'

    if (opening && date < opening.openingDate) {
      found.date = `${opening.name} starts on ${formatDate(opening.openingDate, money.locale)}. Choose that day or later.`
    }

    // The main process re-checks everything; its message belongs in the form, not a toast.
    const onError = (error: Error): void => setFormError(error.message)

    if (splitting) {
      const plan = installmentPlanInputSchema.safeParse({
        accountId: Number(accountId),
        title,
        categoryId: categoryId ? Number(categoryId) : undefined,
        totalAmount: cents ?? 0,
        count: parseCount(count) ?? Number(count),
        firstDate: date,
        note
      })
      if (!plan.success) {
        const { totalAmount, firstDate, ...rest } = fieldErrors(plan.error)
        found = {
          ...rest,
          ...(totalAmount && { amount: totalAmount }),
          ...(firstDate && { date: firstDate }),
          ...found
        }
      }
      if (!plan.success || Object.values(found).some(Boolean)) {
        setErrors(found)
        return
      }
      createPlan.mutate(
        { ...plan.data, note: plan.data.note ?? null },
        {
          onSuccess: (created: InstallmentPlan) => {
            lastAccountId = created.accountId
            toast({
              title: `${created.title} in ${created.count} installments`,
              description: `${money.format(created.installment)} a month from ${formatDate(created.firstDate, money.locale, { day: 'numeric', month: 'short' })}`,
              variant: 'success'
            })
            closeTransactionDialog()
          },
          onError
        }
      )
      return
    }

    const common = {
      title,
      amount: cents ?? 0,
      date,
      accountId: accountId ? Number(accountId) : undefined,
      note
    }
    const parsed = transactionInputSchema.safeParse(
      kind === 'transfer'
        ? { ...common, type: kind, toAccountId: toAccountId ? Number(toAccountId) : undefined }
        : { ...common, type: kind, categoryId: categoryId ? Number(categoryId) : undefined }
    )
    // Problems found above explain more than the schema's messages, so they win.
    if (!parsed.success) found = { ...fieldErrors(parsed.error), ...found }
    if (!parsed.success || Object.values(found).some(Boolean)) {
      setErrors(found)
      return
    }

    const input = { ...parsed.data, note: parsed.data.note ?? null }
    const saved = (verb: string) => (tx: Transaction) => {
      lastAccountId = tx.accountId
      toast({
        title: `${kindNames[kind]} ${verb}`,
        description: `${tx.title} · ${money.format(tx.amount)}`,
        variant: 'success'
      })
      closeTransactionDialog()
    }

    if (existing) {
      updateTransaction.mutate({ id: existing.id, input }, { onSuccess: saved('saved'), onError })
    } else {
      createTransaction.mutate(input, { onSuccess: saved('added'), onError })
    }
  }

  const defaultTitle =
    kind === 'transfer'
      ? account && toAccount && defaultTransferTitle(account, toAccount)
      : category?.name
  const titlePlaceholder = defaultTitle
    ? `Leave empty to use “${defaultTitle}”`
    : kind === 'transfer'
      ? 'e.g. ATM Ilica'
      : 'e.g. Lidl weekly shop'

  if (existing && confirmDelete) {
    const remove = (): void =>
      deleteTransaction.mutate(existing.id, {
        onSuccess: () => {
          toast({ title: 'Transaction deleted', variant: 'success' })
          closeTransactionDialog()
        },
        onError: (error) => setFormError(error.message)
      })
    return (
      <>
        <DialogHeader>
          <DialogTitle>Delete “{existing.title}”?</DialogTitle>
          <DialogDescription>
            {money.format(existing.amount)} on {formatDate(existing.date, money.locale)}. The
            account balance changes back. This can’t be undone.
          </DialogDescription>
        </DialogHeader>
        {formError && <FormError message={formError} />}
        <DialogFooter>
          <Button variant="outline" onClick={() => setConfirmDelete(false)}>
            Back
          </Button>
          <Button variant="danger" disabled={pending} onClick={remove}>
            Delete transaction
          </Button>
        </DialogFooter>
      </>
    )
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>{existing ? 'Edit transaction' : 'Add transaction'}</DialogTitle>
        <DialogDescription>{kindDescriptions[kind]}</DialogDescription>
      </DialogHeader>

      <div className="grid gap-5">
        <SegmentedControl
          name="transaction-kind"
          aria-label="Type"
          value={kind}
          options={kindOptions}
          onValueChange={changeKind}
          className="justify-self-start"
        />

        <div className="grid gap-1.5">
          <Label htmlFor="tx-amount">Amount</Label>
          <AmountInput
            id="tx-amount"
            size="lg"
            autoFocus
            value={amount}
            placeholder={`0${decimalSeparator(money.locale)}00`}
            {...errorProps('tx-amount', errors.amount)}
            onChange={(event) => {
              setAmount(event.target.value)
              clearError('amount')
            }}
          />
          <FieldError id="tx-amount-error" message={errors.amount} />
        </div>

        {kind === 'transfer' ? (
          <>
            <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
              <div className="grid gap-1.5">
                <Label htmlFor="tx-account">From</Label>
                <AccountSelect
                  id="tx-account"
                  value={accountId}
                  accounts={accountOptions}
                  error={errors.accountId}
                  onChange={changeAccount}
                />
                <FieldError id="tx-account-error" message={errors.accountId} />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="mt-6"
                aria-label="Swap accounts"
                title="Swap accounts"
                onClick={swapAccounts}
              >
                <ArrowLeftRight />
              </Button>
              <div className="grid gap-1.5">
                <Label htmlFor="tx-to-account">To</Label>
                <AccountSelect
                  id="tx-to-account"
                  value={toAccountId}
                  accounts={accountOptions.filter((a) => String(a.id) !== accountId)}
                  error={errors.toAccountId}
                  onChange={(value) => {
                    setToAccountId(value)
                    clearError('toAccountId')
                    clearError('date')
                  }}
                />
                <FieldError id="tx-to-account-error" message={errors.toAccountId} />
              </div>
            </div>
            {toAccount && owedOnCard > 0 && (
              <p className="-mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
                <span>
                  {toAccount.name} owes{' '}
                  <span className="amount text-ink">{money.format(owedOnCard)}</span>.
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setAmount(money.toInput(owedOnCard))
                    clearError('amount')
                  }}
                >
                  Pay it all
                </Button>
              </p>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid content-start gap-1.5">
                <Label htmlFor="tx-date">Date</Label>
                <DatePicker
                  id="tx-date"
                  value={date}
                  min={opening?.openingDate}
                  {...errorProps('tx-date', errors.date)}
                  onChange={(value) => {
                    setDate(value)
                    clearError('date')
                  }}
                />
                <FieldError id="tx-date-error" message={errors.date} />
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid content-start gap-1.5">
                <Label htmlFor="tx-category">Category</Label>
                <CategorySelect
                  id="tx-category"
                  value={categoryId}
                  categories={categoryOptions}
                  error={errors.categoryId}
                  onChange={(value) => {
                    setCategoryId(value)
                    clearError('categoryId')
                  }}
                />
                <FieldError id="tx-category-error" message={errors.categoryId} />
              </div>

              <div className="grid content-start gap-1.5">
                <Label htmlFor="tx-date">Date</Label>
                <DatePicker
                  id="tx-date"
                  value={date}
                  min={opening?.openingDate}
                  {...errorProps('tx-date', errors.date)}
                  onChange={(value) => {
                    setDate(value)
                    clearError('date')
                  }}
                />
                <FieldError id="tx-date-error" message={errors.date} />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="tx-account">{kind === 'expense' ? 'Paid with' : 'Paid into'}</Label>
              <AccountSelect
                id="tx-account"
                value={accountId}
                accounts={accountOptions}
                error={errors.accountId}
                onChange={changeAccount}
              />
              <FieldError id="tx-account-error" message={errors.accountId} />
              {countsIn && account && (
                <p className="text-sm text-ink-muted">
                  {inInstallments && canSplit ? 'The first installment counts' : 'Counts'} in{' '}
                  {countsIn} — {account.name} bill due{' '}
                  {formatDate(countsOn, money.locale, { day: 'numeric', month: 'short' })}
                </p>
              )}
            </div>
          </>
        )}

        {canSplit && (
          <InstallmentsField
            enabled={inInstallments}
            onEnabledChange={(on) => {
              setInInstallments(on)
              clearError('count')
            }}
            count={count}
            onCountChange={(value) => {
              setCount(value)
              clearError('count')
            }}
            total={money.parse(amount)}
            firstDate={date}
            error={errors.count}
          />
        )}

        <div className="grid gap-1.5">
          <Label htmlFor="tx-title">
            Title <span className="font-normal text-ink-muted">(optional)</span>
          </Label>
          <Input
            id="tx-title"
            value={title}
            maxLength={80}
            placeholder={titlePlaceholder}
            {...errorProps('tx-title', errors.title)}
            onChange={(event) => {
              setTitle(event.target.value)
              clearError('title')
            }}
          />
          <FieldError id="tx-title-error" message={errors.title} />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="tx-note">
            Note <span className="font-normal text-ink-muted">(optional)</span>
          </Label>
          <Textarea
            id="tx-note"
            rows={2}
            maxLength={500}
            value={note}
            {...errorProps('tx-note', errors.note)}
            onChange={(event) => {
              setNote(event.target.value)
              clearError('note')
            }}
          />
          <FieldError id="tx-note-error" message={errors.note} />
        </div>
      </div>

      {formError && <FormError message={formError} className="mt-5" />}

      {isInstallment && existing && (
        <p className="mt-5 text-sm text-ink-muted">
          One installment of a purchase on the card. To remove it, delete the whole purchase from{' '}
          <Link
            to={accountPath(existing.accountId)}
            onClick={closeTransactionDialog}
            className="link font-semibold text-primary"
          >
            the card’s page
          </Link>
          .
        </p>
      )}

      <DialogFooter className={existing && !isInstallment ? 'justify-between' : undefined}>
        {existing && !isInstallment && (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              className="text-expense hover:text-expense"
              disabled={pending}
              onClick={() => setConfirmDelete(true)}
            >
              Delete…
            </Button>
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => duplicateTransaction(existing)}
            >
              <Copy />
              Duplicate
            </Button>
          </div>
        )}
        <div className="flex gap-2">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button type="submit" disabled={pending}>
            {existing ? 'Save transaction' : splitting ? 'Add in installments' : 'Add transaction'}
          </Button>
        </div>
      </DialogFooter>
    </form>
  )
}

function NoAccounts(): React.JSX.Element {
  const navigate = useNavigate()
  return (
    <>
      <DialogHeader>
        <DialogTitle>Add an account first</DialogTitle>
        <DialogDescription>
          Every transaction is paid with or into one of your accounts: a debit card, credit card or
          cash.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">Cancel</Button>
        </DialogClose>
        <Button
          onClick={() => {
            closeTransactionDialog()
            navigate('/accounts')
          }}
        >
          <Wallet />
          Go to accounts
        </Button>
      </DialogFooter>
    </>
  )
}

function DialogBody({ target }: { target: TransactionDialogTarget }): React.JSX.Element | null {
  const accounts = useAccounts()
  const categories = useCategories()
  const transaction = useTransaction(target.kind === 'edit' ? target.id : null)

  if (transaction.isError) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Transaction not found</DialogTitle>
          <DialogDescription>{transaction.error.message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </>
    )
  }
  if (!accounts.data || !categories.data) return null
  if (target.kind === 'edit' && !transaction.data) return null
  if (target.kind === 'new' && !accounts.data.some((a) => !a.isArchived)) return <NoAccounts />
  if (transaction.data && isAdjustment(transaction.data.type)) {
    return (
      <AdjustmentForm
        key={transaction.data.id}
        existing={transaction.data}
        account={accounts.data.find((a) => a.id === transaction.data.accountId)}
      />
    )
  }

  return (
    <TransactionForm
      key={target.kind === 'edit' ? `edit-${target.id}` : 'new'}
      accounts={accounts.data}
      categories={categories.data}
      existing={target.kind === 'edit' ? (transaction.data ?? null) : null}
      prefill={target.kind === 'new' ? target.prefill : undefined}
    />
  )
}

/** The app-wide Add / Edit transaction dialog. Open it with `openTransactionDialog`. */
export function TransactionDialog(): React.JSX.Element {
  const target = useTransactionDialogTarget()
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && closeTransactionDialog()}>
      <DialogContent className="w-[min(36rem,calc(100vw-2rem))]">
        {target && <DialogBody target={target} />}
      </DialogContent>
    </Dialog>
  )
}
