import { useState } from 'react'
import type { Account } from '@shared/accounts'
import { formatDate, type IsoDate } from '@shared/dates'
import { decimalSeparator } from '@shared/money'
import type { RecurringItem } from '@shared/recurring'
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
import { Label } from '@renderer/components/ui/label'
import { AccountSelect } from '@renderer/features/accounts/AccountSelect'
import { useAccounts } from '@renderer/features/accounts/queries'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { errorProps } from '@renderer/lib/forms'
import { toast } from '@renderer/lib/toast'
import { usePostOccurrence } from './queries'

export interface ConfirmPaymentTarget {
  item: RecurringItem
  plannedDate: IsoDate
}

type Field = 'amount' | 'accountId' | 'date'

function ConfirmForm({
  target: { item, plannedDate },
  accounts,
  onClose
}: {
  target: ConfirmPaymentTarget
  accounts: Account[]
  onClose: () => void
}): React.JSX.Element {
  const money = useCurrency()
  const usable = accounts.filter((a) => !a.isArchived)
  const isIncome = item.kind === 'income'

  const [amount, setAmount] = useState(money.toInput(item.amount))
  const [accountId, setAccountId] = useState(
    usable.some((a) => a.id === item.accountId) ? String(item.accountId) : ''
  )
  const [date, setDate] = useState<IsoDate>(plannedDate)
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const postOccurrence = usePostOccurrence()

  const account = usable.find((a) => String(a.id) === accountId)

  const clearError = (field: Field): void => {
    setErrors((current) => ({ ...current, [field]: undefined }))
    setFormError(null)
  }

  const submit = (event: React.FormEvent): void => {
    event.preventDefault()
    const found: Partial<Record<Field, string>> = {}
    const cents = money.parse(amount)
    if (amount.trim() === '') found.amount = 'Enter the amount'
    else if (cents === null) found.amount = `Enter an amount like ${money.toInput(1250)}`
    else if (cents <= 0) found.amount = 'Enter an amount above zero'
    if (!account) found.accountId = 'Choose an account'
    else if (date < account.openingDate) {
      found.date = `${account.name} starts on ${formatDate(account.openingDate, money.locale)}. Choose that day or later.`
    }
    if (Object.values(found).some(Boolean) || cents === null || !account) {
      setErrors(found)
      return
    }

    postOccurrence.mutate(
      { itemId: item.id, plannedDate, date, amount: cents, accountId: account.id },
      {
        onSuccess: (tx) => {
          toast({
            title: isIncome ? `${item.title} received` : `${item.title} paid`,
            description: `${money.format(tx.amount)} on ${formatDate(tx.date, money.locale)}`,
            variant: 'success'
          })
          onClose()
        },
        onError: (error) => setFormError(error.message)
      }
    )
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>
          {isIncome ? 'Confirm' : 'Pay'} “{item.title}”
        </DialogTitle>
        <DialogDescription>
          Due{' '}
          {formatDate(plannedDate, money.locale, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          })}
          . Change anything that was different this time.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-5">
        <div className="grid gap-1.5">
          <Label htmlFor="confirm-amount">Amount</Label>
          <AmountInput
            id="confirm-amount"
            size="lg"
            autoFocus
            value={amount}
            placeholder={`0${decimalSeparator(money.locale)}00`}
            {...errorProps('confirm-amount', errors.amount)}
            onChange={(event) => {
              setAmount(event.target.value)
              clearError('amount')
            }}
          />
          <FieldError id="confirm-amount-error" message={errors.amount} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid content-start gap-1.5">
            <Label htmlFor="confirm-account">{isIncome ? 'Paid into' : 'Paid with'}</Label>
            <AccountSelect
              id="confirm-account"
              value={accountId}
              accounts={usable}
              error={errors.accountId}
              onChange={(value) => {
                setAccountId(value)
                clearError('accountId')
                clearError('date')
              }}
            />
            <FieldError id="confirm-account-error" message={errors.accountId} />
          </div>
          <div className="grid content-start gap-1.5">
            <Label htmlFor="confirm-date">{isIncome ? 'Received on' : 'Paid on'}</Label>
            <DatePicker
              id="confirm-date"
              value={date}
              min={account?.openingDate}
              {...errorProps('confirm-date', errors.date)}
              onChange={(value) => {
                setDate(value)
                clearError('date')
              }}
            />
            <FieldError id="confirm-date-error" message={errors.date} />
          </div>
        </div>
      </div>

      {formError && <FormError message={formError} className="mt-5" />}

      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">Cancel</Button>
        </DialogClose>
        <Button type="submit" disabled={postOccurrence.isPending}>
          {isIncome ? 'Mark as received' : 'Mark as paid'}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Confirms a due (or planned) occurrence as paid, creating its transaction. */
export function ConfirmPaymentDialog({
  target,
  onClose
}: {
  target: ConfirmPaymentTarget | null
  onClose: () => void
}): React.JSX.Element {
  const accounts = useAccounts()
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[min(32rem,calc(100vw-2rem))]">
        {target && accounts.data && (
          <ConfirmForm
            key={`${target.item.id}-${target.plannedDate}`}
            target={target}
            accounts={accounts.data}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
