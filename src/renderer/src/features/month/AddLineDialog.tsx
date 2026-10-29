import { useState } from 'react'
import { countedDate } from '@shared/cards'
import { formatDate, today, type IsoDate } from '@shared/dates'
import { decimalSeparator } from '@shared/money'
import {
  monthKeyOf,
  monthLineInputSchema,
  monthRange,
  type LineRepeat,
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
import { SegmentedControl } from '@renderer/components/ui/segmented-control'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { AccountSelect } from '@renderer/features/accounts/AccountSelect'
import { useAccounts } from '@renderer/features/accounts/queries'
import { useSettings } from '@renderer/features/settings/queries'
import { countsInMonth } from '@renderer/features/transactions/countsIn'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { errorProps, fieldErrors } from '@renderer/lib/forms'
import { toast } from '@renderer/lib/toast'
import { useAddMonthLine } from './queries'

/** What "+" picked: a category of the section's type, existing or new. */
export interface LineTarget {
  type: MonthLineType
  name: string
  isNew: boolean
}

type Field = 'title' | 'amount' | 'accountId' | 'date'
type Mode = 'once' | 'repeat'

const modeOptions: { value: Mode; label: string }[] = [
  { value: 'once', label: 'One-time' },
  { value: 'repeat', label: 'Recurring' }
]

/** How often a recurring line can repeat, as Select values. */
const repeats: { value: string; label: string; repeat: LineRepeat }[] = [
  { value: 'weekly-1', label: 'Every week', repeat: { frequency: 'weekly', interval: 1 } },
  { value: 'monthly-1', label: 'Every month', repeat: { frequency: 'monthly', interval: 1 } },
  { value: 'monthly-2', label: 'Every 2 months', repeat: { frequency: 'monthly', interval: 2 } },
  { value: 'monthly-3', label: 'Every 3 months', repeat: { frequency: 'monthly', interval: 3 } },
  { value: 'monthly-6', label: 'Every 6 months', repeat: { frequency: 'monthly', interval: 6 } },
  { value: 'yearly-1', label: 'Every year', repeat: { frequency: 'yearly', interval: 1 } }
]

/** The date it starts on: today in the month shown, else that month's 1st. */
const startDate = (month: MonthKey): IsoDate =>
  monthKeyOf(today()) === month ? today() : monthRange(month).start

function AddLineForm({
  month,
  target,
  onClose
}: {
  month: MonthKey
  target: LineTarget
  onClose: () => void
}): React.JSX.Element {
  const money = useCurrency()
  const accounts = (useAccounts().data ?? []).filter((a) => !a.isArchived)
  const cardSpendingMonth = useSettings().data?.cardSpendingMonth ?? 'payment'
  const addLine = useAddMonthLine()

  const [mode, setMode] = useState<Mode>('once')
  const [repeat, setRepeat] = useState('monthly-1')
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [accountId, setAccountId] = useState(
    String((accounts.find((a) => a.type !== 'credit') ?? accounts[0])?.id ?? '')
  )
  const [date, setDate] = useState<IsoDate>(startDate(month))
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)

  const clearError = (field: Field): void => {
    setErrors((current) => ({ ...current, [field]: undefined }))
    setFormError(null)
  }

  const recurring = mode === 'repeat'
  const noun = target.type === 'income' ? 'income' : 'expense'
  const account = accounts.find((a) => String(a.id) === accountId)
  const countsIn =
    account && countsInMonth(date, countedDate(date, account, cardSpendingMonth), money.locale)

  const submit = (event: React.FormEvent): void => {
    event.preventDefault()
    const cents = amount.trim() === '' ? 0 : money.parse(amount)
    const parsed = monthLineInputSchema.safeParse({
      month,
      type: target.type,
      name: target.name,
      title: recurring ? title : undefined,
      amount: cents ?? -1,
      accountId: accountId ? Number(accountId) : undefined,
      date,
      repeat: recurring ? (repeats.find((r) => r.value === repeat)?.repeat ?? null) : null
    })
    if (cents === null || !parsed.success) {
      setErrors({
        ...(parsed.success ? {} : fieldErrors(parsed.error)),
        ...(cents === null && { amount: `Enter an amount like ${money.toInput(4550)}` })
      })
      return
    }
    const name = parsed.data.title || target.name
    const often = repeats.find((r) => r.value === repeat)?.label.toLowerCase()
    addLine.mutate(parsed.data, {
      onSuccess: () => {
        toast({
          title: recurring
            ? `${name} added, ${often}`
            : cents > 0
              ? `${money.format(cents)} added to ${target.name}`
              : `${target.name} added to the sheet`,
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
        <DialogTitle>{target.isNew ? `New ${noun}: ${target.name}` : target.name}</DialogTitle>
        <DialogDescription>
          {target.isNew
            ? `Creates the ${noun} category “${target.name}”. `
            : `Adds to your “${target.name}” category. `}
          One-time adds a single {noun}; recurring plans it ahead and asks you to confirm each one.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-5">
        <SegmentedControl
          name="line-mode"
          aria-label="One-time or recurring"
          value={mode}
          options={modeOptions}
          onValueChange={(next) => {
            setMode(next)
            clearError('amount')
          }}
          className="justify-self-start"
        />

        {recurring && (
          <div className="grid grid-cols-2 gap-4">
            <div className="grid content-start gap-1.5">
              <Label htmlFor="line-repeat">How often</Label>
              <Select value={repeat} onValueChange={setRepeat}>
                <SelectTrigger id="line-repeat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {repeats.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid content-start gap-1.5">
              <Label htmlFor="line-title">
                Name <span className="font-normal text-ink-muted">(optional)</span>
              </Label>
              <Input
                id="line-title"
                value={title}
                maxLength={80}
                placeholder={target.name}
                {...errorProps('line-title', errors.title)}
                onChange={(event) => {
                  setTitle(event.target.value)
                  clearError('title')
                }}
              />
              <FieldError id="line-title-error" message={errors.title} />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="grid content-start gap-1.5">
            <Label htmlFor="line-amount">
              {recurring ? 'Amount each time' : 'Amount'}{' '}
              {!recurring && <span className="font-normal text-ink-muted">(optional)</span>}
            </Label>
            <AmountInput
              id="line-amount"
              autoFocus
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
            <Label htmlFor="line-date">{recurring ? 'First one on' : 'Date'}</Label>
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
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="line-account">
            {target.type === 'income' ? 'Paid into' : 'Paid with'}
          </Label>
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
          {countsIn && account && (
            <p className="text-sm text-ink-muted">
              {recurring ? 'The first one counts' : 'Counts'} in {countsIn} — {account.name} bill
              due{' '}
              {formatDate(countedDate(date, account, cardSpendingMonth), money.locale, {
                day: 'numeric',
                month: 'short'
              })}
            </p>
          )}
        </div>

        {!recurring && amount.trim() === '' && (
          <p className="text-sm text-ink-muted">
            With no amount, {target.name} just goes on the sheet, to type its total later.
          </p>
        )}
      </div>

      {formError && <FormError message={formError} className="mt-5" />}

      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">Cancel</Button>
        </DialogClose>
        <Button type="submit" disabled={addLine.isPending}>
          {recurring ? `Add recurring ${noun}` : `Add ${noun}`}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Adds to a category picked or created from "+": one-time, or recurring from a date. */
export function AddLineDialog({
  month,
  target,
  onClose
}: {
  month: MonthKey
  /** null while closed. */
  target: LineTarget | null
  onClose: () => void
}): React.JSX.Element {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {target && (
          <AddLineForm
            key={`${target.type}-${target.name}`}
            month={month}
            target={target}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
