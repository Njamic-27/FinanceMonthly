import { useState } from 'react'
import type { Account } from '@shared/accounts'
import { amortizationSchedule, totalInterest } from '@shared/amortization'
import { addMonths, formatDate, today, type IsoDate } from '@shared/dates'
import { bankLoanInputSchema, defaultBankLoanTitle, type Loan } from '@shared/loans'
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
import { Switch } from '@renderer/components/ui/switch'
import { Textarea } from '@renderer/components/ui/textarea'
import { AccountSelect } from '@renderer/features/accounts/AccountSelect'
import { useAccounts } from '@renderer/features/accounts/queries'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { errorProps, fieldErrors } from '@renderer/lib/forms'
import { toast } from '@renderer/lib/toast'
import { useCreateBankLoan, useDeleteLoan, useUpdateBankLoan } from './queries'
import { t } from '@renderer/lib/i18n'

type Field =
  | 'counterparty'
  | 'title'
  | 'principal'
  | 'interestRate'
  | 'installmentsCount'
  | 'startDate'
  | 'firstPaymentDate'
  | 'accountId'
  | 'note'

/** A rate typed with either decimal separator ("5,9" or "5.9"); null if it isn't a number. */
function parseRate(value: string): number | null {
  const n = Number(value.trim().replace(',', '.').replace('%', ''))
  return value.trim() !== '' && Number.isFinite(n) ? n : null
}

function BankLoanForm({
  existing,
  accounts,
  onClose,
  onDeleted
}: {
  existing: Loan | null
  accounts: Account[]
  onClose: () => void
  onDeleted?: () => void
}): React.JSX.Element {
  const money = useCurrency()
  const usable = accounts.filter((a) => !a.isArchived || a.id === existing?.accountId)
  // Once an installment is paid, the terms stay as they are.
  const locked = (existing?.bank?.paidCount ?? 0) > 0
  const startDefault = today()

  const [counterparty, setCounterparty] = useState(existing?.counterparty ?? '')
  const [title, setTitle] = useState(() =>
    existing && existing.title !== defaultBankLoanTitle(existing.counterparty) ? existing.title : ''
  )
  const [principal, setPrincipal] = useState(existing ? money.toInput(existing.principal) : '')
  const [rate, setRate] = useState(
    existing?.interestRate != null
      ? String(existing.interestRate).replace('.', decimalSeparator(money.locale))
      : ''
  )
  const [count, setCount] = useState(String(existing?.installmentsCount ?? 60))
  const [startDate, setStartDate] = useState<IsoDate>(existing?.startDate ?? startDefault)
  const [firstPaymentDate, setFirstPaymentDate] = useState<IsoDate>(
    existing?.bank?.firstPaymentDate ?? addMonths(startDefault, 1)
  )
  const [recordMoney, setRecordMoney] = useState(existing?.createDisbursementTx ?? false)
  const [autoPay, setAutoPay] = useState(existing?.autoPay ?? true)
  const [accountId, setAccountId] = useState(() =>
    String(existing?.accountId ?? usable.find((a) => a.type === 'debit')?.id ?? usable[0]?.id ?? '')
  )
  const [note, setNote] = useState(existing?.note ?? '')
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const create = useCreateBankLoan()
  const update = useUpdateBankLoan()
  const remove = useDeleteLoan()
  const pending = create.isPending || update.isPending || remove.isPending

  const cents = money.parse(principal)
  const rateValue = parseRate(rate)
  const countValue = Number(count)
  const preview =
    cents &&
    cents > 0 &&
    rateValue !== null &&
    rateValue >= 0 &&
    rateValue < 100 &&
    Number.isInteger(countValue) &&
    countValue >= 1 &&
    countValue <= 600
      ? amortizationSchedule(cents, rateValue, countValue, firstPaymentDate)
      : null

  const clearError = (field: Field): void => {
    setErrors((current) => ({ ...current, [field]: undefined }))
    setFormError(null)
  }
  const onError = (error: Error): void => setFormError(error.message)

  const submit = (event: React.FormEvent): void => {
    event.preventDefault()
    let found: Partial<Record<Field, string>> = {}
    if (principal.trim() === '') found.principal = t('recurring.enterTheAmount')
    else if (cents === null) {
      found.principal = t('line.enterAmountLike', { example: money.toInput(1200000) })
    }
    if (rateValue === null) found.interestRate = t('loans.enterTheYearlyRate')
    const parsed = bankLoanInputSchema.safeParse({
      counterparty,
      title,
      principal: cents ?? 0,
      interestRate: rateValue ?? 0,
      installmentsCount: count.trim() === '' ? undefined : countValue,
      startDate,
      firstPaymentDate,
      createDisbursementTx: recordMoney,
      autoPay,
      accountId: accountId ? Number(accountId) : undefined,
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
    if (existing) update.mutate({ id: existing.id, input }, { onSuccess: saved, onError })
    else create.mutate(input, { onSuccess: saved, onError })
  }

  if (existing && confirmDelete) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>{t('panel.deleteTitle', { title: existing.title })}</DialogTitle>
          <DialogDescription>
            {t('loans.itsScheduleAndEvery')} {t('recurring.thisCantBeUndone')}
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
              remove.mutate(existing.id, {
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

  const placeholder = `0${decimalSeparator(money.locale)}00`

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>{existing ? t('loans.editBankLoan') : t('add.newBankLoan')}</DialogTitle>
        <DialogDescription>{t('loans.aLoanPaidBack')}</DialogDescription>
      </DialogHeader>

      <div className="grid gap-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="grid content-start gap-1.5">
            <Label htmlFor="bank-name">{t('loans.bank')}</Label>
            <Input
              id="bank-name"
              value={counterparty}
              autoFocus
              maxLength={60}
              placeholder="e.g. Erste"
              {...errorProps('bank-name', errors.counterparty)}
              onChange={(event) => {
                setCounterparty(event.target.value)
                clearError('counterparty')
              }}
            />
            <FieldError id="bank-name-error" message={errors.counterparty} />
          </div>
          <div className="grid content-start gap-1.5">
            <Label htmlFor="bank-title">
              {t('common.titleOptional')}{' '}
              <span className="font-normal text-ink-muted">{t('common.optional')}</span>
            </Label>
            <Input
              id="bank-title"
              value={title}
              maxLength={80}
              placeholder={t('loans.titlePlaceholder')}
              {...errorProps('bank-title', errors.title)}
              onChange={(event) => {
                setTitle(event.target.value)
                clearError('title')
              }}
            />
            <FieldError id="bank-title-error" message={errors.title} />
          </div>
        </div>

        {locked && (
          <p className="rounded-control bg-surface-2 px-3 py-2.5 text-sm text-ink-muted">
            {t('loans.installmentsArePaidAlready')}
          </p>
        )}

        <div className="grid grid-cols-3 gap-4">
          <div className="grid content-start gap-1.5">
            <Label htmlFor="bank-principal">{t('common.amount')}</Label>
            <AmountInput
              id="bank-principal"
              value={principal}
              disabled={locked}
              placeholder={placeholder}
              {...errorProps('bank-principal', errors.principal)}
              onChange={(event) => {
                setPrincipal(event.target.value)
                clearError('principal')
              }}
            />
            <FieldError id="bank-principal-error" message={errors.principal} />
          </div>
          <div className="grid content-start gap-1.5">
            <Label htmlFor="bank-rate">{t('loans.yearlyInterest')}</Label>
            <div className="flex items-center gap-2">
              <Input
                id="bank-rate"
                inputMode="decimal"
                value={rate}
                disabled={locked}
                placeholder={`5${decimalSeparator(money.locale)}9`}
                {...errorProps('bank-rate', errors.interestRate)}
                onChange={(event) => {
                  setRate(event.target.value)
                  clearError('interestRate')
                }}
              />
              <span className="text-ink-muted">%</span>
            </div>
            <FieldError id="bank-rate-error" message={errors.interestRate} />
          </div>
          <div className="grid content-start gap-1.5">
            <Label htmlFor="bank-count">{t('accounts.installments')}</Label>
            <Input
              id="bank-count"
              type="number"
              min={1}
              max={600}
              value={count}
              disabled={locked}
              {...errorProps('bank-count', errors.installmentsCount)}
              onChange={(event) => {
                setCount(event.target.value)
                clearError('installmentsCount')
              }}
            />
            <FieldError id="bank-count-error" message={errors.installmentsCount} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid content-start gap-1.5">
            <Label htmlFor="bank-start">{t('loans.paidOutOn')}</Label>
            <DatePicker
              id="bank-start"
              value={startDate}
              {...errorProps('bank-start', errors.startDate)}
              disabled={locked}
              onChange={(value) => {
                setStartDate(value)
                if (firstPaymentDate <= value) setFirstPaymentDate(addMonths(value, 1))
                clearError('startDate')
                clearError('firstPaymentDate')
              }}
            />
            <FieldError id="bank-start-error" message={errors.startDate} />
          </div>
          <div className="grid content-start gap-1.5">
            <Label htmlFor="bank-first">{t('loans.firstInstallment')}</Label>
            <DatePicker
              id="bank-first"
              value={firstPaymentDate}
              {...errorProps('bank-first', errors.firstPaymentDate)}
              disabled={locked}
              onChange={(value) => {
                setFirstPaymentDate(value)
                clearError('firstPaymentDate')
              }}
            />
            <FieldError id="bank-first-error" message={errors.firstPaymentDate} />
          </div>
        </div>

        {preview && (
          <dl
            className="grid grid-cols-3 gap-4 rounded-control bg-surface-2 p-3"
            aria-live="polite"
          >
            <div>
              <dt className="text-sm text-ink-muted">{t('panel.eachMonth')}</dt>
              <dd className="amount text-lg">{money.format(preview[0].amount)}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">{t('loans.interestInTotal')}</dt>
              <dd className="amount text-lg">{money.format(totalInterest(preview))}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">{t('accounts.paidOff')}</dt>
              <dd className="text-lg font-semibold">
                {formatDate(preview[preview.length - 1].dueDate, money.locale, {
                  month: 'short',
                  year: 'numeric'
                })}
              </dd>
            </div>
          </dl>
        )}

        <div className="grid gap-1.5">
          <Label htmlFor="bank-account">{t('loans.installmentsPaidFrom')}</Label>
          <AccountSelect
            id="bank-account"
            value={accountId}
            accounts={usable}
            error={errors.accountId}
            onChange={(value) => {
              setAccountId(value)
              clearError('accountId')
            }}
          />
          <FieldError id="bank-account-error" message={errors.accountId} />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="bank-autopay">{t('loans.payAutomatically')}</Label>
            <p id="bank-autopay-description" className="text-sm text-ink-muted">
              {autoPay ? t('loans.eachInstallmentIsMarked') : t('loans.youMarkEachInstallment')}
            </p>
          </div>
          <Switch
            id="bank-autopay"
            checked={autoPay}
            onCheckedChange={setAutoPay}
            aria-describedby="bank-autopay-description"
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="bank-record">{t('loans.theMoneyCameInto')}</Label>
            <p id="bank-record-description" className="text-sm text-ink-muted">
              {t('loans.turnOnForA')}
            </p>
          </div>
          <Switch
            id="bank-record"
            checked={recordMoney}
            disabled={locked}
            onCheckedChange={setRecordMoney}
            aria-describedby="bank-record-description"
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="bank-note">
            {t('common.note')}{' '}
            <span className="font-normal text-ink-muted">{t('common.optional')}</span>
          </Label>
          <Textarea
            id="bank-note"
            rows={2}
            maxLength={500}
            value={note}
            {...errorProps('bank-note', errors.note)}
            onChange={(event) => {
              setNote(event.target.value)
              clearError('note')
            }}
          />
          <FieldError id="bank-note-error" message={errors.note} />
        </div>
      </div>

      {formError && <FormError message={formError} className="mt-5" />}

      {existing && (
        <div className="mt-6 border-t border-line">
          <ActionRow title={t('common.delete')} description={t('loans.removeTheLoanIts')}>
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
          {existing ? t('loans.saveLoan') : t('loans.addBankLoan')}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Add or edit a bank loan; editing also deletes. `loan` null with `open` adds a new one. */
export function BankLoanDialog({
  open,
  loan,
  onClose,
  onDeleted
}: {
  open: boolean
  loan: Loan | null
  onClose: () => void
  onDeleted?: () => void
}): React.JSX.Element {
  const accounts = useAccounts()
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="w-[min(40rem,calc(100vw-2rem))]">
        {open && accounts.data && (
          <BankLoanForm
            key={loan?.id ?? 'new'}
            existing={loan}
            accounts={accounts.data}
            onClose={onClose}
            onDeleted={onDeleted}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
