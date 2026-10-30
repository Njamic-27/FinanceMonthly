import { useState } from 'react'
import { HandCoins, HandHeart, type LucideIcon } from 'lucide-react'
import type { Account } from '@shared/accounts'
import { addMonths, formatDate, today, type IsoDate } from '@shared/dates'
import {
  defaultLoanTitle,
  personalLoanInputSchema,
  type Loan,
  type PersonalLoanKind
} from '@shared/loans'
import { decimalSeparator } from '@shared/money'
import { ActionRow } from '@renderer/components/ActionRow'
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
import { Switch } from '@renderer/components/ui/switch'
import { Textarea } from '@renderer/components/ui/textarea'
import { AccountSelect } from '@renderer/features/accounts/AccountSelect'
import { useAccounts } from '@renderer/features/accounts/queries'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { errorProps, fieldErrors } from '@renderer/lib/forms'
import { toast } from '@renderer/lib/toast'
import { useCreateLoan, useDeleteLoan, useUpdateLoan } from './queries'
import { directionLabels } from './wording'
import { t } from '@renderer/lib/i18n'

export type LoanDialogTarget =
  { kind: 'new'; loanKind: PersonalLoanKind } | { kind: 'edit'; loan: Loan }

type Field = 'counterparty' | 'title' | 'principal' | 'startDate' | 'dueDate' | 'accountId' | 'note'

const kindOptions = (): { value: 'lent' | 'borrowed'; label: string; icon: LucideIcon }[] => [
  { value: 'lent' as const, label: t('loans.iLent'), icon: HandCoins },
  { value: 'borrowed' as const, label: t('loans.iBorrowed'), icon: HandHeart }
]

function LoanForm({
  target,
  accounts,
  onClose,
  onDeleted
}: {
  target: LoanDialogTarget
  accounts: Account[]
  onClose: () => void
  onDeleted?: () => void
}): React.JSX.Element {
  const money = useCurrency()
  const existing = target.kind === 'edit' ? target.loan : null
  const usable = accounts.filter((a) => !a.isArchived || a.id === existing?.accountId)

  const [kind, setKind] = useState<PersonalLoanKind>(
    existing && existing.kind !== 'bank_loan'
      ? existing.kind
      : target.kind === 'new'
        ? target.loanKind
        : 'lent'
  )
  const [counterparty, setCounterparty] = useState(existing?.counterparty ?? '')
  const [title, setTitle] = useState(() =>
    existing &&
    existing.kind !== 'bank_loan' &&
    existing.title !== defaultLoanTitle(existing.kind, existing.counterparty)
      ? existing.title
      : ''
  )
  const [principal, setPrincipal] = useState(existing ? money.toInput(existing.principal) : '')
  const [startDate, setStartDate] = useState<IsoDate>(existing?.startDate ?? today())
  const [hasDue, setHasDue] = useState(existing ? existing.dueDate !== null : false)
  const [dueDate, setDueDate] = useState<IsoDate>(
    existing?.dueDate ?? addMonths(existing?.startDate ?? today(), 3)
  )
  const [recordMoney, setRecordMoney] = useState(existing?.createDisbursementTx ?? true)
  const [accountId, setAccountId] = useState(() =>
    String(existing?.accountId ?? usable.find((a) => a.type === 'debit')?.id ?? usable[0]?.id ?? '')
  )
  const [note, setNote] = useState(existing?.note ?? '')
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const createLoan = useCreateLoan()
  const updateLoan = useUpdateLoan()
  const deleteLoan = useDeleteLoan()
  const pending = createLoan.isPending || updateLoan.isPending || deleteLoan.isPending
  const account = usable.find((a) => String(a.id) === accountId)
  const labels = directionLabels(kind)

  const clearError = (field: Field): void => {
    setErrors((current) => ({ ...current, [field]: undefined }))
    setFormError(null)
  }
  const onError = (error: Error): void => setFormError(error.message)

  const submit = (event: React.FormEvent): void => {
    event.preventDefault()
    let found: Partial<Record<Field, string>> = {}
    const cents = money.parse(principal)
    if (principal.trim() === '') found.principal = t('recurring.enterTheAmount')
    else if (cents === null) {
      found.principal = t('line.enterAmountLike', { example: money.toInput(30000) })
    }
    if (recordMoney && account && startDate < account.openingDate) {
      found.startDate = t('recurring.accountStarts', {
        account: account.name,
        date: formatDate(account.openingDate, money.locale)
      })
    }
    const parsed = personalLoanInputSchema.safeParse({
      kind,
      counterparty,
      title,
      principal: cents ?? 0,
      startDate,
      dueDate: hasDue ? dueDate : null,
      createDisbursementTx: recordMoney,
      accountId: accountId ? Number(accountId) : null,
      note
    })
    if (!parsed.success) found = { ...fieldErrors(parsed.error), ...found }
    if (!parsed.success || Object.values(found).some(Boolean)) {
      setErrors(found)
      return
    }
    const input = { ...parsed.data, note: parsed.data.note ?? null }
    const saved = (loan: Loan): void => {
      toast({ title: existing ? t('loans.loanSaved') : `${loan.title} added`, variant: 'success' })
      onClose()
    }
    if (existing) updateLoan.mutate({ id: existing.id, input }, { onSuccess: saved, onError })
    else createLoan.mutate(input, { onSuccess: saved, onError })
  }

  if (existing && confirmDelete) {
    const count = existing.repaymentCount + (existing.createDisbursementTx ? 1 : 0)
    return (
      <>
        <DialogHeader>
          <DialogTitle>{t('panel.deleteTitle', { title: existing.title })}</DialogTitle>
          <DialogDescription>
            {count > 0 ? t('loans.deleteTransactions', { count }) : t('loans.noMoneyWasRecorded')}{' '}
            {t('recurring.thisCantBeUndone')}
          </DialogDescription>
        </DialogHeader>
        {formError && <FormError message={formError} />}
        <DialogFooter>
          <Button variant="outline" onClick={() => setConfirmDelete(false)}>
            {t('shell.back')}
          </Button>
          <Button
            variant="danger"
            disabled={pending}
            onClick={() =>
              deleteLoan.mutate(existing.id, {
                onSuccess: () => {
                  toast({ title: `${existing.title} deleted`, variant: 'success' })
                  onClose()
                  onDeleted?.()
                },
                onError
              })
            }
          >
            {t('loans.deleteLoan')}
          </Button>
        </DialogFooter>
      </>
    )
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>{existing ? t('loans.editLoan') : t('loans.newLoan')}</DialogTitle>
        <DialogDescription>{t('loans.moneyBetweenYouAnd')}</DialogDescription>
      </DialogHeader>

      <div className="grid gap-5">
        <SegmentedControl
          name="loan-kind"
          aria-label={t('loans.lentOrBorrowed')}
          value={kind}
          options={kindOptions()}
          onValueChange={(value) => {
            setKind(value)
            setFormError(null)
          }}
          className="justify-self-start"
        />

        <div className="grid grid-cols-2 gap-4">
          <div className="grid content-start gap-1.5">
            <Label htmlFor="loan-counterparty">
              {kind === 'lent' ? t('loans.to') : t('loans.from')}
            </Label>
            <Input
              id="loan-counterparty"
              value={counterparty}
              autoFocus
              maxLength={60}
              placeholder="e.g. Marko"
              {...errorProps('loan-counterparty', errors.counterparty)}
              onChange={(event) => {
                setCounterparty(event.target.value)
                clearError('counterparty')
              }}
            />
            <FieldError id="loan-counterparty-error" message={errors.counterparty} />
          </div>
          <div className="grid content-start gap-1.5">
            <Label htmlFor="loan-principal">{t('common.amount')}</Label>
            <AmountInput
              id="loan-principal"
              value={principal}
              placeholder={`0${decimalSeparator(money.locale)}00`}
              {...errorProps('loan-principal', errors.principal)}
              onChange={(event) => {
                setPrincipal(event.target.value)
                clearError('principal')
              }}
            />
            <FieldError id="loan-principal-error" message={errors.principal} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid content-start gap-1.5">
            <Label htmlFor="loan-start">{t('accounts.on')}</Label>
            <DatePicker
              id="loan-start"
              value={startDate}
              {...errorProps('loan-start', errors.startDate)}
              onChange={(value) => {
                setStartDate(value)
                if (dueDate < value) setDueDate(value)
                clearError('startDate')
                clearError('dueDate')
              }}
            />
            <FieldError id="loan-start-error" message={errors.startDate} />
          </div>
          <div className="grid content-start gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="loan-due">{t('loans.paidBackBy')}</Label>
              <Switch
                checked={hasDue}
                onCheckedChange={(on) => {
                  setHasDue(on)
                  clearError('dueDate')
                }}
                aria-label={t('loans.expectedBackByA')}
                className="scale-75"
              />
            </div>
            {hasDue ? (
              <DatePicker
                id="loan-due"
                value={dueDate}
                min={startDate}
                {...errorProps('loan-due', errors.dueDate)}
                onChange={(value) => {
                  setDueDate(value)
                  clearError('dueDate')
                }}
              />
            ) : (
              <p id="loan-due" className="flex h-10 items-center text-sm text-ink-muted">
                {t('loans.noDate')}
              </p>
            )}
            <FieldError id="loan-due-error" message={errors.dueDate} />
          </div>
        </div>

        <div className="grid gap-3 rounded-control bg-surface-2 p-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="loan-record">{t('loans.recordTheMoneyMoving')}</Label>
              <p id="loan-record-description" className="text-sm text-ink-muted">
                {kind === 'lent' ? t('loans.takesItOutOf') : t('loans.addsItToOne')}{' '}
                {t('loans.leaveItOffFor')}
              </p>
            </div>
            <Switch
              id="loan-record"
              checked={recordMoney}
              onCheckedChange={(on) => {
                setRecordMoney(on)
                clearError('accountId')
                clearError('startDate')
              }}
              aria-describedby="loan-record-description"
            />
          </div>
          {recordMoney && (
            <div className="grid gap-1.5">
              <Label htmlFor="loan-account">{labels.account}</Label>
              <AccountSelect
                id="loan-account"
                value={accountId}
                accounts={usable}
                error={errors.accountId}
                onChange={(value) => {
                  setAccountId(value)
                  clearError('accountId')
                  clearError('startDate')
                }}
              />
              <FieldError id="loan-account-error" message={errors.accountId} />
            </div>
          )}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="loan-title">
            {t('common.titleOptional')}{' '}
            <span className="font-normal text-ink-muted">{t('common.optional')}</span>
          </Label>
          <Input
            id="loan-title"
            value={title}
            maxLength={80}
            placeholder={t('loans.leaveEmpty', {
              title: defaultLoanTitle(kind, counterparty.trim() || '…')
            })}
            {...errorProps('loan-title', errors.title)}
            onChange={(event) => {
              setTitle(event.target.value)
              clearError('title')
            }}
          />
          <FieldError id="loan-title-error" message={errors.title} />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="loan-note">
            {t('common.note')}{' '}
            <span className="font-normal text-ink-muted">{t('common.optional')}</span>
          </Label>
          <Textarea
            id="loan-note"
            rows={2}
            maxLength={500}
            value={note}
            placeholder={t('loans.notePlaceholder')}
            {...errorProps('loan-note', errors.note)}
            onChange={(event) => {
              setNote(event.target.value)
              clearError('note')
            }}
          />
          <FieldError id="loan-note-error" message={errors.note} />
        </div>
      </div>

      {formError && <FormError message={formError} className="mt-5" />}

      {existing && (
        <div className="mt-6 border-t border-line">
          <ActionRow title={t('common.delete')} description={t('loans.removeTheLoanAnd')}>
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              className="text-expense"
              onClick={() => setConfirmDelete(true)}
            >
              {t('recurring.delete')}
            </Button>
          </ActionRow>
        </div>
      )}

      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">{t('common.cancel')}</Button>
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {existing ? t('loans.saveLoan') : t('loans.addLoan')}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Add or edit money lent or borrowed; editing also deletes. */
export function LoanDialog({
  target,
  onClose,
  onDeleted
}: {
  target: LoanDialogTarget | null
  onClose: () => void
  onDeleted?: () => void
}): React.JSX.Element {
  const accounts = useAccounts()
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[min(36rem,calc(100vw-2rem))]">
        {target && accounts.data && (
          <LoanForm
            key={target.kind === 'edit' ? target.loan.id : `new-${target.loanKind}`}
            target={target}
            accounts={accounts.data}
            onClose={onClose}
            onDeleted={onDeleted}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
