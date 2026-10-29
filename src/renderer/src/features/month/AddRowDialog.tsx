import { useState } from 'react'
import { today, type IsoDate } from '@shared/dates'
import { decimalSeparator } from '@shared/money'
import {
  monthKeyOf,
  monthLineInputSchema,
  monthRange,
  type MonthKey,
  type MonthLineType
} from '@shared/month'
import { AmountInput } from '@renderer/components/AmountInput'
import { DatePicker } from '@renderer/components/DatePicker'
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
import { Switch } from '@renderer/components/ui/switch'
import { AccountSelect } from '@renderer/features/accounts/AccountSelect'
import { useAccounts } from '@renderer/features/accounts/queries'
import { useCategories } from '@renderer/features/categories/queries'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { errorProps, fieldErrors } from '@renderer/lib/forms'
import { toast } from '@renderer/lib/toast'
import { useAddMonthLine } from './queries'

type Field = 'name' | 'amount' | 'accountId' | 'date'

/** The first payment of a new monthly item: today in this month, else the month's 1st. */
const firstDate = (month: MonthKey): IsoDate =>
  monthKeyOf(today()) === month ? today() : monthRange(month).start

function AddRowForm({
  month,
  type,
  onClose
}: {
  month: MonthKey
  type: MonthLineType
  onClose: () => void
}): React.JSX.Element {
  const money = useCurrency()
  const accounts = (useAccounts().data ?? []).filter((a) => !a.isArchived)
  const categories = (useCategories().data ?? []).filter((c) => c.type === type)
  const addLine = useAddMonthLine()

  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [accountId, setAccountId] = useState(
    String((accounts.find((a) => a.type !== 'credit') ?? accounts[0])?.id ?? '')
  )
  const [everyMonth, setEveryMonth] = useState(false)
  const [date, setDate] = useState<IsoDate>(firstDate(month))
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)

  const clearError = (field: Field): void => {
    setErrors((current) => ({ ...current, [field]: undefined }))
    setFormError(null)
  }

  const known = categories.find((c) => c.name.toLowerCase() === name.trim().toLowerCase())
  const noun = type === 'income' ? 'income' : 'expense'

  const submit = (event: React.FormEvent): void => {
    event.preventDefault()
    const cents = amount.trim() === '' ? 0 : money.parse(amount)
    const parsed = monthLineInputSchema.safeParse({
      month,
      type,
      name,
      amount: cents ?? -1,
      accountId: accountId ? Number(accountId) : undefined,
      everyMonth,
      date: everyMonth ? date : undefined
    })
    if (cents === null || !parsed.success) {
      setErrors({
        ...(parsed.success ? {} : fieldErrors(parsed.error)),
        ...(cents === null && { amount: `Enter an amount like ${money.toInput(4550)}` })
      })
      return
    }
    addLine.mutate(parsed.data, {
      onSuccess: () => {
        toast({
          title: everyMonth
            ? `${parsed.data.name} added, every month`
            : `${parsed.data.name} added`,
          variant: 'success'
        })
        onClose()
      },
      onError: (error) => setFormError(error.message)
    })
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>{type === 'income' ? 'Add income' : 'Add expense'}</DialogTitle>
        <DialogDescription>
          A row for one kind of {noun}, like{' '}
          {type === 'income' ? '“Bonus” or “Side job”' : '“Fuel” or “Groceries”'}. Type its amount
          each month, or add the transactions behind it.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-5">
        <div className="grid gap-1.5">
          <Label htmlFor="line-name">Name</Label>
          <Input
            id="line-name"
            value={name}
            autoFocus
            maxLength={40}
            list="line-categories"
            autoComplete="off"
            placeholder={type === 'income' ? 'e.g. Bonus' : 'e.g. Fuel'}
            {...errorProps('line-name', errors.name)}
            onChange={(event) => {
              setName(event.target.value)
              clearError('name')
            }}
          />
          <datalist id="line-categories">
            {categories.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
          <FieldError id="line-name-error" message={errors.name} />
          {name.trim() !== '' && (
            <p className="text-sm text-ink-muted">
              {known
                ? `Uses your “${known.name}” category${known.isArchived ? ', restored' : ''}.`
                : `Creates a new ${noun} category.`}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid content-start gap-1.5">
            <Label htmlFor="line-amount">
              {everyMonth ? 'Each month' : 'This month'}{' '}
              {!everyMonth && <span className="font-normal text-ink-muted">(optional)</span>}
            </Label>
            <AmountInput
              id="line-amount"
              value={amount}
              placeholder={`0${decimalSeparator(money.locale)}00`}
              {...errorProps('line-amount', errors.amount)}
              onChange={(event) => {
                setAmount(event.target.value)
                clearError('amount')
              }}
            />
            <FieldError id="line-amount-error" message={errors.amount} />
          </div>
          <div className="grid content-start gap-1.5">
            <Label htmlFor="line-account">Account</Label>
            <AccountSelect
              id="line-account"
              value={accountId}
              accounts={accounts}
              error={errors.accountId}
              onChange={(value) => {
                setAccountId(value)
                clearError('accountId')
              }}
            />
            <FieldError id="line-account-error" message={errors.accountId} />
          </div>
        </div>

        <div className="grid gap-3 rounded-panel border border-line p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="line-every-month">Every month</Label>
              <p id="line-every-month-hint" className="text-sm text-ink-muted">
                The same amount each month, like rent or a salary: planned ahead and confirmed when
                it’s {type === 'income' ? 'received' : 'paid'}.
              </p>
            </div>
            <Switch
              id="line-every-month"
              checked={everyMonth}
              aria-describedby="line-every-month-hint"
              onCheckedChange={(on) => {
                setEveryMonth(on)
                clearError('amount')
              }}
            />
          </div>
          {everyMonth && (
            <div className="grid gap-1.5">
              <Label htmlFor="line-date">First payment</Label>
              <DatePicker
                id="line-date"
                value={date}
                {...errorProps('line-date', errors.date)}
                onChange={(value) => {
                  setDate(value)
                  clearError('date')
                }}
              />
              <FieldError id="line-date-error" message={errors.date} />
            </div>
          )}
        </div>
      </div>

      {formError && <FormError message={formError} className="mt-5" />}

      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">Cancel</Button>
        </DialogClose>
        <Button type="submit" disabled={addLine.isPending}>
          {type === 'income' ? 'Add income' : 'Add expense'}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** "+" under Income or Expenses: a row by name, or a monthly payment with "Every month". */
export function AddRowDialog({
  month,
  type,
  onClose
}: {
  month: MonthKey
  /** null while closed. */
  type: MonthLineType | null
  onClose: () => void
}): React.JSX.Element {
  return (
    <Dialog open={type !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {type && <AddRowForm key={type} month={month} type={type} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}
