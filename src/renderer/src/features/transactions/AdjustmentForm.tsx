import { useState } from 'react'
import { adjustmentAmount, adjustmentUpdateSchema } from '@shared/adjustments'
import type { Account } from '@shared/accounts'
import { formatDate } from '@shared/dates'
import type { Transaction } from '@shared/transactions'
import { AmountInput } from '@renderer/components/AmountInput'
import { DatePicker } from '@renderer/components/DatePicker'
import { FieldError } from '@renderer/components/FieldError'
import { FormError } from '@renderer/components/FormError'
import { Button } from '@renderer/components/ui/button'
import {
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { Label } from '@renderer/components/ui/label'
import { SegmentedControl } from '@renderer/components/ui/segmented-control'
import { Textarea } from '@renderer/components/ui/textarea'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { errorProps, fieldErrors } from '@renderer/lib/forms'
import { toast } from '@renderer/lib/toast'
import { closeTransactionDialog } from './dialogStore'
import { useDeleteTransaction, useUpdateAdjustment } from './queries'

type Direction = 'in' | 'out'

const directionOptions: { value: Direction; label: string }[] = [
  { value: 'in', label: 'Added to the account' },
  { value: 'out', label: 'Taken off the account' }
]

/**
 * A balance adjustment in the transaction dialog: which way it moved the balance, by how much,
 * when, and a note. Its account stays: a correction belongs to the account it corrected.
 */
export function AdjustmentForm({
  existing,
  account
}: {
  existing: Transaction
  account: Account | undefined
}): React.JSX.Element {
  const money = useCurrency()
  const signed = adjustmentAmount(existing)
  const [direction, setDirection] = useState<Direction>(signed > 0 ? 'in' : 'out')
  const [amount, setAmount] = useState(money.toInput(Math.abs(signed)))
  const [date, setDate] = useState(existing.date)
  const [note, setNote] = useState(existing.note ?? '')
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const update = useUpdateAdjustment()
  const remove = useDeleteTransaction()
  const pending = update.isPending || remove.isPending
  const clearError = (field: string): void => {
    setErrors((current) => ({ ...current, [field]: undefined }))
    setFormError(null)
  }

  const save = (event: React.FormEvent): void => {
    event.preventDefault()
    const cents = money.parse(amount)
    if (cents === null || cents <= 0) {
      setErrors({ amount: 'Enter an amount above zero, like 25 or 12.50' })
      return
    }
    const parsed = adjustmentUpdateSchema.safeParse({
      amount: direction === 'in' ? cents : -cents,
      date,
      note
    })
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error))
      return
    }
    update.mutate(
      { id: existing.id, input: { ...parsed.data, note: parsed.data.note ?? null } },
      {
        onSuccess: (tx) => {
          toast({
            title: 'Adjustment saved',
            description: `${account?.name ?? tx.title} · ${money.format(adjustmentAmount(tx), 'exceptZero')}`,
            variant: 'success'
          })
          closeTransactionDialog()
        },
        onError: (error) => setFormError(error.message)
      }
    )
  }

  if (confirmDelete) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Delete this adjustment?</DialogTitle>
          <DialogDescription>
            {money.format(signed, 'exceptZero')} on {account?.name ?? 'the account'},{' '}
            {formatDate(existing.date, money.locale)}. The balance goes back to what it was before.
            This can’t be undone.
          </DialogDescription>
        </DialogHeader>
        {formError && <FormError message={formError} />}
        <DialogFooter>
          <Button variant="outline" onClick={() => setConfirmDelete(false)}>
            Back
          </Button>
          <Button
            variant="danger"
            disabled={pending}
            onClick={() =>
              remove.mutate(existing.id, {
                onSuccess: () => {
                  toast({ title: 'Adjustment deleted', variant: 'success' })
                  closeTransactionDialog()
                },
                onError: (error) => setFormError(error.message)
              })
            }
          >
            Delete adjustment
          </Button>
        </DialogFooter>
      </>
    )
  }

  return (
    <form onSubmit={save} noValidate>
      <DialogHeader>
        <DialogTitle>Edit balance adjustment</DialogTitle>
        <DialogDescription>
          A correction to {account?.name ?? 'the account'}’s balance. It isn’t counted as income or
          spending.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-5">
        <SegmentedControl
          name="adjustment-direction"
          aria-label="Which way"
          value={direction}
          options={directionOptions}
          onValueChange={setDirection}
          className="justify-self-start"
        />

        <div className="grid gap-1.5">
          <Label htmlFor="adj-amount">Amount</Label>
          <AmountInput
            id="adj-amount"
            size="lg"
            autoFocus
            value={amount}
            {...errorProps('adj-amount', errors.amount)}
            onChange={(event) => {
              setAmount(event.target.value)
              clearError('amount')
            }}
          />
          <FieldError id="adj-amount-error" message={errors.amount} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid content-start gap-1.5">
            <Label htmlFor="adj-date">Date</Label>
            <DatePicker
              id="adj-date"
              value={date}
              min={account?.openingDate}
              {...errorProps('adj-date', errors.date)}
              onChange={(value) => {
                setDate(value)
                clearError('date')
              }}
            />
            <FieldError id="adj-date-error" message={errors.date} />
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="adj-note">Note</Label>
          <Textarea
            id="adj-note"
            rows={2}
            maxLength={500}
            value={note}
            placeholder="Optional, e.g. what the difference was"
            {...errorProps('adj-note', errors.note)}
            onChange={(event) => {
              setNote(event.target.value)
              clearError('note')
            }}
          />
          <FieldError id="adj-note-error" message={errors.note} />
        </div>
      </div>

      {formError && <FormError message={formError} className="mt-5" />}

      <DialogFooter className="justify-between">
        <Button
          variant="ghost"
          className="text-expense hover:text-expense"
          disabled={pending}
          onClick={() => setConfirmDelete(true)}
        >
          Delete…
        </Button>
        <div className="flex gap-2">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button type="submit" disabled={pending}>
            Save adjustment
          </Button>
        </div>
      </DialogFooter>
    </form>
  )
}
