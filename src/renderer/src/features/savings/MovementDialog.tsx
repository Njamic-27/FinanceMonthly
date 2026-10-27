import { useState } from 'react'
import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react'
import type { Account } from '@shared/accounts'
import { formatDate, today, type IsoDate } from '@shared/dates'
import { decimalSeparator } from '@shared/money'
import { savingsMovementInputSchema, type MovementType, type SavingsGoal } from '@shared/savings'
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
import { SegmentedControl } from '@renderer/components/ui/segmented-control'
import { Textarea } from '@renderer/components/ui/textarea'
import { AccountSelect } from '@renderer/features/accounts/AccountSelect'
import { useAccounts } from '@renderer/features/accounts/queries'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { errorProps, fieldErrors } from '@renderer/lib/forms'
import { toast } from '@renderer/lib/toast'
import {
  useAddSavingsMovement,
  useDeleteSavingsMovement,
  useUpdateSavingsMovement
} from './queries'

export type MovementDialogTarget =
  | { kind: 'new'; goal: SavingsGoal; type: MovementType }
  | { kind: 'edit'; goal: SavingsGoal; movement: Transaction }

type Field = 'amount' | 'accountId' | 'date' | 'note'

const typeOptions = [
  { value: 'deposit' as const, label: 'Put in', icon: ArrowDownToLine },
  { value: 'withdrawal' as const, label: 'Take out', icon: ArrowUpFromLine }
]

/** The account used last, so monthly deposits don't need it picked each time. */
let lastAccountId: number | null = null

function MovementForm({
  target,
  accounts,
  onClose
}: {
  target: MovementDialogTarget
  accounts: Account[]
  onClose: () => void
}): React.JSX.Element {
  const money = useCurrency()
  const { goal } = target
  const existing = target.kind === 'edit' ? target.movement : null
  const usable = accounts.filter((a) => !a.isArchived || a.id === existing?.accountId)

  const [type, setType] = useState<MovementType>(
    existing
      ? existing.type === 'savings_withdrawal'
        ? 'withdrawal'
        : 'deposit'
      : target.kind === 'new'
        ? target.type
        : 'deposit'
  )
  const [amount, setAmount] = useState(() => {
    const cents =
      existing?.amount ?? (type === 'deposit' ? (goal.plannedMonthly ?? undefined) : undefined)
    return cents === undefined ? '' : money.toInput(cents)
  })
  const [accountId, setAccountId] = useState(() =>
    String(
      existing?.accountId ??
        [lastAccountId].find((id) => usable.some((a) => a.id === id)) ??
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

  const add = useAddSavingsMovement()
  const update = useUpdateSavingsMovement()
  const remove = useDeleteSavingsMovement()
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
    else if (cents === null) found.amount = `Enter an amount like ${money.toInput(15000)}`
    if (account && date < account.openingDate) {
      found.date = `${account.name} starts on ${formatDate(account.openingDate, money.locale)}. Choose that day or later.`
    }
    const parsed = savingsMovementInputSchema.safeParse({
      goalId: goal.id,
      type,
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
      lastAccountId = tx.accountId
      toast({
        title: existing
          ? 'Saved'
          : type === 'deposit'
            ? `Put into ${goal.name}`
            : `Taken out of ${goal.name}`,
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
          <DialogTitle>
            Delete this {existing.type === 'savings_deposit' ? 'deposit' : 'withdrawal'}?
          </DialogTitle>
          <DialogDescription>
            {money.format(existing.amount)} on {formatDate(existing.date, money.locale)}. The money
            goes back to where it was. This can’t be undone.
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
                  toast({ title: 'Deleted', variant: 'success' })
                  onClose()
                },
                onError
              })
            }
          >
            Delete
          </Button>
        </DialogFooter>
      </>
    )
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>{goal.name}</DialogTitle>
        <DialogDescription>
          {money.format(goal.saved)} saved of {money.format(goal.targetAmount)}.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-5">
        <SegmentedControl
          name="movement-type"
          aria-label="Put in or take out"
          value={type}
          options={typeOptions}
          onValueChange={(value) => {
            setType(value)
            setFormError(null)
          }}
          className="justify-self-start"
        />

        <div className="grid gap-1.5">
          <Label htmlFor="movement-amount">Amount</Label>
          <AmountInput
            id="movement-amount"
            size="lg"
            autoFocus
            value={amount}
            placeholder={`0${decimalSeparator(money.locale)}00`}
            {...errorProps('movement-amount', errors.amount)}
            onChange={(event) => {
              setAmount(event.target.value)
              clearError('amount')
            }}
          />
          <FieldError id="movement-amount-error" message={errors.amount} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid content-start gap-1.5">
            <Label htmlFor="movement-account">{type === 'deposit' ? 'From' : 'Into'}</Label>
            <AccountSelect
              id="movement-account"
              value={accountId}
              accounts={usable}
              error={errors.accountId}
              onChange={(value) => {
                setAccountId(value)
                clearError('accountId')
                clearError('date')
              }}
            />
            <FieldError id="movement-account-error" message={errors.accountId} />
          </div>
          <div className="grid content-start gap-1.5">
            <Label htmlFor="movement-date">Date</Label>
            <DatePicker
              id="movement-date"
              value={date}
              min={account?.openingDate}
              {...errorProps('movement-date', errors.date)}
              onChange={(value) => {
                setDate(value)
                clearError('date')
              }}
            />
            <FieldError id="movement-date-error" message={errors.date} />
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="movement-note">
            Note <span className="font-normal text-ink-muted">(optional)</span>
          </Label>
          <Textarea
            id="movement-note"
            rows={2}
            maxLength={500}
            value={note}
            {...errorProps('movement-note', errors.note)}
            onChange={(event) => {
              setNote(event.target.value)
              clearError('note')
            }}
          />
          <FieldError id="movement-note-error" message={errors.note} />
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
            {existing ? 'Save' : type === 'deposit' ? 'Put in' : 'Take out'}
          </Button>
        </div>
      </DialogFooter>
    </form>
  )
}

/** Put money into a goal or take it out; editing also deletes. */
export function MovementDialog({
  target,
  onClose
}: {
  target: MovementDialogTarget | null
  onClose: () => void
}): React.JSX.Element {
  const accounts = useAccounts()
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[min(32rem,calc(100vw-2rem))]">
        {target && accounts.data && (
          <MovementForm
            key={
              target.kind === 'edit' ? target.movement.id : `new-${target.goal.id}-${target.type}`
            }
            target={target}
            accounts={accounts.data}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
