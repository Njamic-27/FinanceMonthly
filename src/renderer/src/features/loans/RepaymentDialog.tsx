import { useState } from 'react'
import type { Account } from '@shared/accounts'
import { formatDate, today, type IsoDate } from '@shared/dates'
import { repaymentInputSchema, type Loan } from '@shared/loans'
import { decimalSeparator } from '@shared/money'
import type { Transaction } from '@shared/transactions'
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
import { Textarea } from '@renderer/components/ui/textarea'
import { AccountSelect } from '@renderer/features/accounts/AccountSelect'
import { useAccounts } from '@renderer/features/accounts/queries'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { errorProps, fieldErrors } from '@renderer/lib/forms'
import { toast } from '@renderer/lib/toast'
import { useAddRepayment, useDeleteRepayment, useUpdateRepayment } from './queries'
import { directionLabels, owedLabel } from './wording'

export type RepaymentDialogTarget =
  { kind: 'new'; loan: Loan } | { kind: 'edit'; loan: Loan; repayment: Transaction }

type Field = 'amount' | 'accountId' | 'date' | 'note'

function RepaymentForm({
  target,
  accounts,
  onClose
}: {
  target: RepaymentDialogTarget
  accounts: Account[]
  onClose: () => void
}): React.JSX.Element {
  const money = useCurrency()
  const { loan } = target
  const existing = target.kind === 'edit' ? target.repayment : null
  const usable = accounts.filter((a) => !a.isArchived || a.id === existing?.accountId)
  const labels = directionLabels[loan.kind === 'lent' ? 'lent' : 'borrowed']

  const [amount, setAmount] = useState(money.toInput(existing?.amount ?? loan.outstanding))
  const [accountId, setAccountId] = useState(() =>
    String(
      existing?.accountId ??
        [loan.accountId].find((id) => usable.some((a) => a.id === id)) ??
        usable.find((a) => a.type === 'debit')?.id ??
        usable[0]?.id ??
        ''
    )
  )
  const [date, setDate] = useState<IsoDate>(existing?.date ?? today())
  const [note, setNote] = useState(existing?.note ?? '')
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const add = useAddRepayment()
  const update = useUpdateRepayment()
  const remove = useDeleteRepayment()
  const pending = add.isPending || update.isPending || remove.isPending
  const account = usable.find((a) => String(a.id) === accountId)

  const clearError = (field: Field): void => {
    setErrors((current) => ({ ...current, [field]: undefined }))
    setFormError(null)
  }
  const onError = (error: Error): void => setFormError(error.message)

  const submit = (event: React.FormEvent): void => {
    event.preventDefault()
    let found: Partial<Record<Field, string>> = {}
    const cents = money.parse(amount)
    if (amount.trim() === '') found.amount = 'Enter the amount'
    else if (cents === null) found.amount = `Enter an amount like ${money.toInput(10000)}`
    if (account && date < account.openingDate) {
      found.date = `${account.name} starts on ${formatDate(account.openingDate, money.locale)}. Choose that day or later.`
    }
    const parsed = repaymentInputSchema.safeParse({
      loanId: loan.id,
      amount: cents ?? 0,
      accountId: accountId ? Number(accountId) : undefined,
      date,
      note
    })
    if (!parsed.success) found = { ...fieldErrors(parsed.error), ...found }
    if (!parsed.success || Object.values(found).some(Boolean)) {
      setErrors(found)
      return
    }
    const input = { ...parsed.data, note: parsed.data.note ?? null }
    const saved = (tx: Transaction): void => {
      toast({
        title: existing ? 'Saved' : 'Repayment recorded',
        description: money.format(tx.amount),
        variant: 'success'
      })
      onClose()
    }
    if (existing) update.mutate({ id: existing.id, input }, { onSuccess: saved, onError })
    else add.mutate(input, { onSuccess: saved, onError })
  }

  if (existing && confirmDelete) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Delete this repayment?</DialogTitle>
          <DialogDescription>
            {money.format(existing.amount)} on {formatDate(existing.date, money.locale)}. It counts
            as owed again. This can’t be undone.
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
                  toast({ title: 'Repayment deleted', variant: 'success' })
                  onClose()
                },
                onError
              })
            }
          >
            Delete repayment
          </Button>
        </DialogFooter>
      </>
    )
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>{existing ? 'Edit repayment' : labels.repayment}</DialogTitle>
        <DialogDescription>
          {owedLabel(loan)} {money.format(loan.outstanding)} on “{loan.title}”.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-5">
        <div className="grid gap-1.5">
          <Label htmlFor="repayment-amount">Amount</Label>
          <AmountInput
            id="repayment-amount"
            size="lg"
            autoFocus
            value={amount}
            placeholder={`0${decimalSeparator(money.locale)}00`}
            {...errorProps('repayment-amount', errors.amount)}
            onChange={(event) => {
              setAmount(event.target.value)
              clearError('amount')
            }}
          />
          <FieldError id="repayment-amount-error" message={errors.amount} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid content-start gap-1.5">
            <Label htmlFor="repayment-account">{labels.repaymentAccount}</Label>
            <AccountSelect
              id="repayment-account"
              value={accountId}
              accounts={usable}
              error={errors.accountId}
              onChange={(value) => {
                setAccountId(value)
                clearError('accountId')
                clearError('date')
              }}
            />
            <FieldError id="repayment-account-error" message={errors.accountId} />
          </div>
          <div className="grid content-start gap-1.5">
            <Label htmlFor="repayment-date">Date</Label>
            <DatePicker
              id="repayment-date"
              value={date}
              min={loan.startDate}
              {...errorProps('repayment-date', errors.date)}
              onChange={(value) => {
                setDate(value)
                clearError('date')
              }}
            />
            <FieldError id="repayment-date-error" message={errors.date} />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="repayment-note">
            Note <span className="font-normal text-ink-muted">(optional)</span>
          </Label>
          <Textarea
            id="repayment-note"
            rows={2}
            maxLength={500}
            value={note}
            {...errorProps('repayment-note', errors.note)}
            onChange={(event) => {
              setNote(event.target.value)
              clearError('note')
            }}
          />
          <FieldError id="repayment-note-error" message={errors.note} />
        </div>
      </div>

      {formError && <FormError message={formError} className="mt-5" />}

      <DialogFooter className={existing ? 'justify-between' : undefined}>
        {existing && (
          <Button
            variant="ghost"
            className="text-expense hover:text-expense"
            disabled={pending}
            onClick={() => setConfirmDelete(true)}
          >
            Delete…
          </Button>
        )}
        <div className="flex gap-2">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button type="submit" disabled={pending}>
            {existing ? 'Save' : 'Record repayment'}
          </Button>
        </div>
      </DialogFooter>
    </form>
  )
}

/** Record money paid back on a loan, or edit or delete a repayment. */
export function RepaymentDialog({
  target,
  onClose
}: {
  target: RepaymentDialogTarget | null
  onClose: () => void
}): React.JSX.Element {
  const accounts = useAccounts()
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[min(32rem,calc(100vw-2rem))]">
        {target && accounts.data && (
          <RepaymentForm
            key={target.kind === 'edit' ? target.repayment.id : `new-${target.loan.id}`}
            target={target}
            accounts={accounts.data}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
