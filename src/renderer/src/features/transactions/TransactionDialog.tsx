import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowDownLeft, ArrowUpRight, CircleAlert, Copy, Wallet } from 'lucide-react'
import type { Account } from '@shared/accounts'
import type { Category } from '@shared/categories'
import { formatDate, today, type IsoDate } from '@shared/dates'
import { decimalSeparator } from '@shared/money'
import { transactionInputSchema, type Transaction } from '@shared/transactions'
import { AmountInput } from '@renderer/components/AmountInput'
import { ColorChip } from '@renderer/components/ColorChip'
import { DatePicker } from '@renderer/components/DatePicker'
import { FieldError } from '@renderer/components/FieldError'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { Textarea } from '@renderer/components/ui/textarea'
import { accountTypeIcons } from '@renderer/features/accounts/appearance'
import { useAccounts } from '@renderer/features/accounts/queries'
import { categoryIconComponents } from '@renderer/features/categories/appearance'
import { useCategories } from '@renderer/features/categories/queries'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { errorProps, fieldErrors } from '@renderer/lib/forms'
import { toast } from '@renderer/lib/toast'
import { cn } from '@renderer/lib/utils'
import {
  closeTransactionDialog,
  duplicateTransaction,
  useTransactionDialogTarget,
  type TransactionDialogTarget,
  type TransactionPrefill
} from './dialogStore'
import {
  useCreateTransaction,
  useDeleteTransaction,
  useTransaction,
  useUpdateTransaction
} from './queries'

type Kind = 'income' | 'expense'
type Field = 'amount' | 'title' | 'categoryId' | 'accountId' | 'date' | 'note'

const kindOptions = [
  { value: 'expense' as const, label: 'Expense', icon: ArrowUpRight },
  { value: 'income' as const, label: 'Income', icon: ArrowDownLeft }
]

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
    existing?.type === 'income' || existing?.type === 'expense'
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
  const [date, setDate] = useState<IsoDate>(existing?.date ?? prefill?.date ?? today())
  const [note, setNote] = useState(existing?.note ?? prefill?.note ?? '')
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const createTransaction = useCreateTransaction()
  const updateTransaction = useUpdateTransaction()
  const deleteTransaction = useDeleteTransaction()
  const pending =
    createTransaction.isPending || updateTransaction.isPending || deleteTransaction.isPending

  // Archived ones stay listed only when this transaction already uses them.
  const accountOptions = accounts.filter((a) => !a.isArchived || a.id === existing?.accountId)
  const categoryOptions = categories.filter(
    (c) => c.type === kind && (!c.isArchived || c.id === existing?.categoryId)
  )
  const account = accounts.find((a) => String(a.id) === accountId)
  const category = categories.find((c) => String(c.id) === categoryId)

  const clearError = (field: Field): void => {
    setErrors((current) => ({ ...current, [field]: undefined }))
    setFormError(null)
  }

  const changeKind = (next: Kind): void => {
    setKind(next)
    // A category belongs to one kind; keep it only if it still fits.
    if (category && category.type !== next) setCategoryId('')
    clearError('categoryId')
  }

  const submit = (event: React.FormEvent): void => {
    event.preventDefault()
    let found: Partial<Record<Field, string>> = {}

    const cents = money.parse(amount)
    if (amount.trim() === '') found.amount = 'Enter the amount'
    else if (cents === null) found.amount = `Enter an amount like ${money.toInput(1250)}`
    else if (cents < 0) found.amount = 'Enter the amount without a minus sign'

    if (account && date < account.openingDate) {
      found.date = `${account.name} starts on ${formatDate(account.openingDate, money.locale)}. Choose that day or later.`
    }

    const parsed = transactionInputSchema.safeParse({
      type: kind,
      title,
      amount: cents ?? 0,
      date,
      accountId: accountId ? Number(accountId) : undefined,
      categoryId: categoryId ? Number(categoryId) : undefined,
      note
    })
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
        title: `${tx.type === 'income' ? 'Income' : 'Expense'} ${verb}`,
        description: `${tx.title} · ${money.format(tx.amount)}`,
        variant: 'success'
      })
      closeTransactionDialog()
    }
    // The main process re-checks everything; its message belongs in the form, not a toast.
    const onError = (error: Error): void => setFormError(error.message)

    if (existing) {
      updateTransaction.mutate({ id: existing.id, input }, { onSuccess: saved('saved'), onError })
    } else {
      createTransaction.mutate(input, { onSuccess: saved('added'), onError })
    }
  }

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
        <DialogDescription>
          {kind === 'expense' ? 'Money you spent.' : 'Money you received.'}
        </DialogDescription>
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

        <div className="grid grid-cols-2 gap-4">
          <div className="grid content-start gap-1.5">
            <Label htmlFor="tx-category">Category</Label>
            <Select
              value={categoryId}
              onValueChange={(value) => {
                setCategoryId(value)
                clearError('categoryId')
              }}
            >
              <SelectTrigger id="tx-category" {...errorProps('tx-category', errors.categoryId)}>
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    <span className="flex items-center gap-2">
                      <ColorChip color={c.color} icon={categoryIconComponents[c.icon]} size="sm" />
                      {c.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError id="tx-category-error" message={errors.categoryId} />
          </div>
          <div className="grid content-start gap-1.5">
            <Label htmlFor="tx-date">Date</Label>
            <DatePicker
              id="tx-date"
              value={date}
              min={account?.openingDate}
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
          <Select
            value={accountId}
            onValueChange={(value) => {
              setAccountId(value)
              clearError('accountId')
              clearError('date')
            }}
          >
            <SelectTrigger id="tx-account" {...errorProps('tx-account', errors.accountId)}>
              <SelectValue placeholder="Choose an account" />
            </SelectTrigger>
            <SelectContent>
              {accountOptions.map((a) => (
                <SelectItem key={a.id} value={String(a.id)}>
                  <span className="flex items-center gap-2">
                    <ColorChip color={a.color} icon={accountTypeIcons[a.type]} size="sm" />
                    {a.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError id="tx-account-error" message={errors.accountId} />
        </div>

        {/* Step 25: "Pay in installments" for an expense on a credit card goes here. */}

        <div className="grid gap-1.5">
          <Label htmlFor="tx-title">
            Title <span className="font-normal text-ink-muted">(optional)</span>
          </Label>
          <Input
            id="tx-title"
            value={title}
            maxLength={80}
            placeholder={
              category ? `Leave empty to use “${category.name}”` : 'e.g. Lidl weekly shop'
            }
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

      <DialogFooter className={existing ? 'justify-between' : undefined}>
        {existing && (
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
            {existing ? 'Save transaction' : 'Add transaction'}
          </Button>
        </div>
      </DialogFooter>
    </form>
  )
}

function FormError({
  message,
  className
}: {
  message: string
  className?: string
}): React.JSX.Element {
  return (
    <p
      role="alert"
      className={cn(
        'flex gap-2.5 rounded-control bg-expense-soft px-3 py-2.5 text-sm text-ink',
        className
      )}
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0 text-expense" aria-hidden />
      {message}
    </p>
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
