import { useState } from 'react'
import {
  accountInputSchema,
  accountTypeLabels,
  accountTypes,
  type Account,
  type AccountType
} from '@shared/accounts'
import { today } from '@shared/dates'
import { decimalSeparator } from '@shared/money'
import { nextPaletteColor, type PaletteColor } from '@shared/palette'
import { ActionRow } from '@renderer/components/ActionRow'
import { AmountInput } from '@renderer/components/AmountInput'
import { ColorChip } from '@renderer/components/ColorChip'
import { ColorPicker } from '@renderer/components/ColorPicker'
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
import { useCurrency } from '@renderer/hooks/useCurrency'
import { ApiError } from '@renderer/lib/api'
import { errorProps, fieldErrors } from '@renderer/lib/forms'
import { toast } from '@renderer/lib/toast'
import { accountTypeIcons } from './appearance'
import { useArchiveAccount, useCreateAccount, useDeleteAccount, useUpdateAccount } from './queries'

export type AccountDialogTarget =
  { kind: 'new'; type?: AccountType } | { kind: 'edit'; account: Account }

interface AccountDialogProps {
  target: AccountDialogTarget | null
  /** All accounts, for the default colour of a new one. */
  accounts: Account[]
  onClose: () => void
  /** Reports success in place of a toast, e.g. inline in the setup wizard. */
  onDone?: (message: string) => void
}

type Field = 'name' | 'balance' | 'openingDate' | 'creditLimit' | 'statementDay' | 'paymentDueDay'

const balanceLabels: Record<AccountType, { label: string; hint: string }> = {
  debit: {
    label: 'Balance',
    hint: 'What the account held on this date. Transactions from then on are added to it.'
  },
  credit: {
    label: 'Amount owed',
    hint: 'What you owed on the card on this date, or 0. Spending from then on adds to it.'
  },
  cash: {
    label: 'Cash on hand',
    hint: 'What you had on this date. Cash you take out or spend from then on changes it.'
  }
}

const typeOptions = accountTypes.map((type) => ({
  value: type,
  label: accountTypeLabels[type],
  icon: accountTypeIcons[type]
}))

const showError = (title: string) => (error: Error) =>
  toast({ title, description: error.message, variant: 'error' })

function AccountForm({
  target,
  accounts,
  onClose,
  onDone
}: AccountDialogProps & { target: AccountDialogTarget }): React.JSX.Element {
  const money = useCurrency()
  const existing = target.kind === 'edit' ? target.account : null
  const done = (message: string): void => {
    if (onDone) onDone(message)
    else toast({ title: message, variant: 'success' })
    onClose()
  }

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [type, setType] = useState<AccountType>(
    existing?.type ?? (target.kind === 'new' ? target.type : undefined) ?? 'debit'
  )
  const [name, setName] = useState(existing?.name ?? '')
  const [color, setColor] = useState<PaletteColor>(
    existing?.color ?? nextPaletteColor(accounts.filter((a) => !a.isArchived).map((a) => a.color))
  )
  const [balance, setBalance] = useState(
    existing
      ? money.toInput(
          existing.type === 'credit' ? -existing.openingBalance : existing.openingBalance
        )
      : ''
  )
  const [openingDate, setOpeningDate] = useState(existing?.openingDate ?? today())
  const [creditLimit, setCreditLimit] = useState(
    existing?.creditLimit != null ? money.toInput(existing.creditLimit) : ''
  )
  const [statementDay, setStatementDay] = useState(existing?.statementDay?.toString() ?? '')
  const [paymentDueDay, setPaymentDueDay] = useState(existing?.paymentDueDay?.toString() ?? '')
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})

  const createAccount = useCreateAccount()
  const updateAccount = useUpdateAccount()
  const archiveAccount = useArchiveAccount()
  const deleteAccount = useDeleteAccount()
  const pending =
    createAccount.isPending ||
    updateAccount.isPending ||
    archiveAccount.isPending ||
    deleteAccount.isPending

  const isCredit = type === 'credit'
  const amountExample = money.toInput(123456)
  const clearError = (field: Field): void =>
    setErrors((current) => ({ ...current, [field]: undefined }))

  /** A name clash belongs next to the name field; anything else is a toast. */
  const nameErrorOr =
    (title: string) =>
    (error: Error): void => {
      if (error instanceof ApiError && error.code === 'conflict') setErrors({ name: error.message })
      else showError(title)(error)
    }

  const submit = (event: React.FormEvent): void => {
    event.preventDefault()
    let found: Partial<Record<Field, string>> = {}

    const balanceCents = balance.trim() === '' ? 0 : money.parse(balance)
    if (balanceCents === null) found.balance = `Enter an amount like ${amountExample}`
    else if (isCredit && balanceCents < 0) {
      found.balance = 'Enter what you owe as a positive amount, or 0'
    }
    const limitCents = isCredit ? money.parse(creditLimit) : null
    if (isCredit && limitCents === null) {
      found.creditLimit = creditLimit.trim()
        ? `Enter an amount like ${amountExample}`
        : 'Enter the card’s credit limit'
    }
    const day = (value: string): number | null => (value.trim() === '' ? null : Number(value))

    const common = { name, color, openingDate }
    const opening = balanceCents ?? 0
    const parsed = accountInputSchema.safeParse(
      isCredit
        ? {
            ...common,
            type,
            openingBalance: opening === 0 ? 0 : -opening,
            creditLimit: limitCents ?? 0,
            statementDay: day(statementDay),
            paymentDueDay: day(paymentDueDay)
          }
        : { ...common, type, openingBalance: opening }
    )
    // Amount problems found above explain more than the schema's messages, so they win.
    if (!parsed.success) {
      const { openingBalance, ...rest } = fieldErrors(parsed.error)
      found = { ...rest, ...(openingBalance ? { balance: openingBalance } : {}), ...found }
    }
    if (!parsed.success || Object.keys(found).length > 0) {
      setErrors(found)
      return
    }

    if (existing) {
      updateAccount.mutate(
        { id: existing.id, input: parsed.data },
        {
          onSuccess: () => done('Account saved'),
          onError: nameErrorOr('Account not saved')
        }
      )
    } else {
      createAccount.mutate(parsed.data, {
        onSuccess: (created) => done(`${created.name} added`),
        onError: nameErrorOr('Account not added')
      })
    }
  }

  if (existing && confirmDelete) {
    const remove = (): void =>
      deleteAccount.mutate(existing.id, {
        onSuccess: () => done(`${existing.name} deleted`),
        onError: showError('Account not deleted')
      })
    return (
      <>
        <DialogHeader>
          <DialogTitle>Delete “{existing.name}”?</DialogTitle>
          <DialogDescription>
            It has no transactions, so nothing else changes. This can’t be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setConfirmDelete(false)}>
            Back
          </Button>
          <Button variant="danger" disabled={pending} onClick={remove}>
            Delete account
          </Button>
        </DialogFooter>
      </>
    )
  }

  const setArchived = (archived: boolean): void => {
    if (!existing) return
    archiveAccount.mutate(
      { id: existing.id, archived },
      {
        onSuccess: () => done(`${existing.name} ${archived ? 'archived' : 'restored'}`),
        onError: showError(archived ? 'Account not archived' : 'Account not restored')
      }
    )
  }

  const { label: balanceLabel, hint: balanceHint } = balanceLabels[type]

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>{existing ? 'Edit account' : 'New account'}</DialogTitle>
        <DialogDescription>
          {existing
            ? 'Changes to the starting balance or date update the balance straight away.'
            : 'A card, bank account or wallet you pay from or get paid into.'}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-5">
        <div className="grid gap-2">
          <span id="account-type-label" className="text-sm font-semibold">
            Type
          </span>
          <SegmentedControl
            name="account-type"
            aria-labelledby="account-type-label"
            value={type}
            options={typeOptions}
            onValueChange={setType}
            className="justify-self-start"
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="account-name">Name</Label>
          <div className="flex items-center gap-3">
            <ColorChip color={color} icon={accountTypeIcons[type]} />
            <Input
              id="account-name"
              value={name}
              autoFocus
              maxLength={40}
              placeholder={
                isCredit
                  ? 'e.g. Mastercard Gold'
                  : type === 'cash'
                    ? 'e.g. Wallet'
                    : 'e.g. Visa Debit'
              }
              {...errorProps('account-name', errors.name)}
              onChange={(event) => {
                setName(event.target.value)
                clearError('name')
              }}
            />
          </div>
          <FieldError id="account-name-error" message={errors.name} />
        </div>

        <ColorPicker name="account-color" value={color} onChange={setColor} />

        <div className="grid gap-1.5">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="account-balance">{balanceLabel}</Label>
              <AmountInput
                id="account-balance"
                value={balance}
                placeholder={`0${decimalSeparator(money.locale)}00`}
                {...errorProps('account-balance', errors.balance)}
                onChange={(event) => {
                  setBalance(event.target.value)
                  clearError('balance')
                }}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="account-date">On</Label>
              <DatePicker
                id="account-date"
                value={openingDate}
                {...errorProps('account-date', errors.openingDate)}
                onChange={(date) => {
                  setOpeningDate(date)
                  clearError('openingDate')
                }}
              />
            </div>
          </div>
          <FieldError id="account-balance-error" message={errors.balance} />
          <FieldError id="account-date-error" message={errors.openingDate} />
          <p className="text-sm text-ink-muted">{balanceHint}</p>
        </div>

        {isCredit && (
          <div className="grid gap-1.5">
            <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="account-limit">Credit limit</Label>
                <AmountInput
                  id="account-limit"
                  value={creditLimit}
                  placeholder={`0${decimalSeparator(money.locale)}00`}
                  {...errorProps('account-limit', errors.creditLimit)}
                  onChange={(event) => {
                    setCreditLimit(event.target.value)
                    clearError('creditLimit')
                  }}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="account-statement-day">Statement day</Label>
                <Input
                  id="account-statement-day"
                  type="number"
                  min={1}
                  max={31}
                  placeholder="Optional"
                  value={statementDay}
                  {...errorProps('account-statement-day', errors.statementDay)}
                  onChange={(event) => {
                    setStatementDay(event.target.value)
                    clearError('statementDay')
                  }}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="account-due-day">Payment due day</Label>
                <Input
                  id="account-due-day"
                  type="number"
                  min={1}
                  max={31}
                  placeholder="Optional"
                  value={paymentDueDay}
                  {...errorProps('account-due-day', errors.paymentDueDay)}
                  onChange={(event) => {
                    setPaymentDueDay(event.target.value)
                    clearError('paymentDueDay')
                  }}
                />
              </div>
            </div>
            <FieldError id="account-limit-error" message={errors.creditLimit} />
            <FieldError id="account-statement-day-error" message={errors.statementDay} />
            <FieldError id="account-due-day-error" message={errors.paymentDueDay} />
            <p className="text-sm text-ink-muted">
              Days of the month the statement closes and the payment is due, for reminders.
            </p>
          </div>
        )}
      </div>

      {existing && (
        <div className="mt-6 divide-y divide-line border-t border-line">
          <ActionRow
            title={existing.isArchived ? 'Restore' : 'Archive'}
            description={
              existing.isArchived
                ? 'Offer it again when adding transactions.'
                : 'Hide it from new transactions and totals. Its history stays.'
            }
          >
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => setArchived(!existing.isArchived)}
            >
              {existing.isArchived ? 'Restore account' : 'Archive account'}
            </Button>
          </ActionRow>
          <ActionRow
            title="Delete"
            description={
              existing.usageCount > 0
                ? 'Only accounts without transactions can be deleted. Archive this one instead.'
                : 'Remove it for good.'
            }
          >
            {existing.usageCount === 0 && (
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                className="text-expense"
                onClick={() => setConfirmDelete(true)}
              >
                Delete…
              </Button>
            )}
          </ActionRow>
        </div>
      )}

      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">Cancel</Button>
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {existing ? 'Save account' : 'Add account'}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Add or edit an account; editing also offers archive and delete. */
export function AccountDialog({
  target,
  accounts,
  onClose,
  onDone
}: AccountDialogProps): React.JSX.Element {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[min(36rem,calc(100vw-2rem))]">
        {target && (
          <AccountForm
            key={target.kind === 'edit' ? target.account.id : 'new'}
            target={target}
            accounts={accounts}
            onClose={onClose}
            onDone={onDone}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
