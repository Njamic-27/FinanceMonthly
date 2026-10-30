import { useState } from 'react'
import { accountInputSchema, accountTypes, type Account, type AccountType } from '@shared/accounts'
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
import { AccountSelect } from './AccountSelect'
import { accountTypeIcons } from './appearance'
import { useArchiveAccount, useCreateAccount, useDeleteAccount, useUpdateAccount } from './queries'
import type { LucideIcon } from 'lucide-react'
import { t } from '@renderer/lib/i18n'

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

const balanceLabels = (type: AccountType): { label: string; hint: string } =>
  ({
    debit: {
      label: t('accounts.balance'),
      hint: t('accounts.whatTheAccountHeld')
    },
    credit: {
      label: t('accounts.amountOwed'),
      hint: t('accounts.whatYouOwedOn')
    },
    cash: {
      label: t('accounts.cashOnHand'),
      hint: t('accounts.whatYouHadOn')
    }
  })[type]

const typeOptions = (): { value: AccountType; label: string; icon: LucideIcon }[] =>
  accountTypes.map((type) => ({
    value: type,
    label: t(`accountType.${type}`),
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
  // The account a card's bill is paid from: a debit account or cash, never a card.
  const payFromOptions = accounts.filter(
    (a) => a.type !== 'credit' && !a.isArchived && a.id !== existing?.id
  )
  const [payFrom, setPayFrom] = useState(
    String(
      existing?.payFromAccountId ??
        (payFromOptions.find((a) => a.type === 'debit') ?? payFromOptions[0])?.id ??
        ''
    )
  )
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
  // A new card's spending counts in the month its bill is paid, which needs both days.
  const daysRequired = isCredit && !existing
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
    if (balanceCents === null) {
      found.balance = t('line.enterAmountLike', { example: amountExample })
    } else if (isCredit && balanceCents < 0) {
      found.balance = t('accounts.enterWhatYouOwe')
    }
    const limitCents = isCredit ? money.parse(creditLimit) : null
    if (isCredit && limitCents === null) {
      found.creditLimit = creditLimit.trim()
        ? t('line.enterAmountLike', { example: amountExample })
        : t('accounts.enterTheCardsCredit')
    }
    const day = (value: string): number | null => (value.trim() === '' ? null : Number(value))
    if (daysRequired && day(statementDay) === null) {
      found.statementDay = t('accounts.enterTheDayOf')
    }
    if (daysRequired && day(paymentDueDay) === null) {
      found.paymentDueDay = t('accounts.enterTheDayOf2')
    }

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
            paymentDueDay: day(paymentDueDay),
            payFromAccountId: payFrom ? Number(payFrom) : null
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
          onSuccess: () => done(t('accounts.accountSaved')),
          onError: nameErrorOr(t('accounts.accountNotSaved'))
        }
      )
    } else {
      createAccount.mutate(parsed.data, {
        onSuccess: (created) => done(`${created.name} added`),
        onError: nameErrorOr(t('accounts.accountNotAdded'))
      })
    }
  }

  if (existing && confirmDelete) {
    const remove = (): void =>
      deleteAccount.mutate(existing.id, {
        onSuccess: () => done(`${existing.name} deleted`),
        onError: showError(t('accounts.accountNotDeleted'))
      })
    return (
      <>
        <DialogHeader>
          <DialogTitle>{t('panel.deleteTitle', { title: existing.name })}</DialogTitle>
          <DialogDescription>{t('accounts.itHasNoTransactions')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setConfirmDelete(false)}>
            {t('shell.back')}
          </Button>
          <Button variant="danger" disabled={pending} onClick={remove}>
            {t('accounts.deleteAccount')}
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
        onError: showError(
          archived ? t('accounts.accountNotArchived') : t('accounts.accountNotRestored')
        )
      }
    )
  }

  const { label: balanceLabel, hint: balanceHint } = balanceLabels(type)

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>{existing ? t('accounts.editAccount') : t('accounts.newAccount')}</DialogTitle>
        <DialogDescription>
          {existing ? t('accounts.changesToTheStarting') : t('accounts.aCardBankAccount')}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-5">
        <div className="grid gap-2">
          <span id="account-type-label" className="text-sm font-semibold">
            {t('accounts.type')}
          </span>
          <SegmentedControl
            name="account-type"
            aria-labelledby="account-type-label"
            value={type}
            options={typeOptions()}
            onValueChange={setType}
            className="justify-self-start"
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="account-name">{t('common.name')}</Label>
          <div className="flex items-center gap-3">
            <ColorChip color={color} icon={accountTypeIcons[type]} />
            <Input
              id="account-name"
              value={name}
              autoFocus
              maxLength={40}
              placeholder={t('common.eg', {
                example: isCredit ? 'Mastercard Gold' : type === 'cash' ? 'Wallet' : 'Visa Debit'
              })}
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
              <Label htmlFor="account-date">{t('accounts.on')}</Label>
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
                <Label htmlFor="account-limit">{t('accounts.creditLimit')}</Label>
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
                <Label htmlFor="account-statement-day">{t('accounts.statementDay')}</Label>
                <Input
                  id="account-statement-day"
                  type="number"
                  min={1}
                  max={31}
                  placeholder={
                    daysRequired ? t('common.eg', { example: 25 }) : t('accounts.optional')
                  }
                  value={statementDay}
                  {...errorProps('account-statement-day', errors.statementDay)}
                  onChange={(event) => {
                    setStatementDay(event.target.value)
                    clearError('statementDay')
                  }}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="account-due-day">{t('accounts.paymentDueDay')}</Label>
                <Input
                  id="account-due-day"
                  type="number"
                  min={1}
                  max={31}
                  placeholder={
                    daysRequired ? t('common.eg', { example: 15 }) : t('accounts.optional')
                  }
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
            <p className="text-sm text-ink-muted">{t('accounts.daysOfTheMonth')}</p>
          </div>
        )}

        {isCredit && payFromOptions.length > 0 && (
          <div className="grid gap-1.5">
            <Label htmlFor="account-pay-from">{t('accounts.paidFrom')}</Label>
            <AccountSelect
              id="account-pay-from"
              value={payFrom}
              accounts={payFromOptions}
              onChange={setPayFrom}
            />
            <p className="text-sm text-ink-muted">{t('accounts.theAccountTheBill')}</p>
          </div>
        )}
      </div>

      {existing && (
        <div className="mt-6 divide-y divide-line border-t border-line">
          <ActionRow
            title={existing.isArchived ? t('accounts.restore') : t('accounts.archive')}
            description={
              existing.isArchived ? t('accounts.offerItAgainWhen') : t('accounts.hideItFromNew')
            }
          >
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => setArchived(!existing.isArchived)}
            >
              {existing.isArchived ? t('accounts.restoreAccount') : t('accounts.archiveAccount')}
            </Button>
          </ActionRow>
          <ActionRow
            title={t('common.delete')}
            description={
              existing.usageCount > 0
                ? t('accounts.onlyAccountsWithoutTransactions')
                : t('accounts.removeItForGood')
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
                {t('recurring.delete')}
              </Button>
            )}
          </ActionRow>
        </div>
      )}

      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">{t('common.cancel')}</Button>
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {existing ? t('accounts.saveAccount') : t('accounts.addAccount')}
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
