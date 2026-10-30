import { useState } from 'react'
import type { Account } from '@shared/accounts'
import { today, type IsoDate } from '@shared/dates'
import type { Loan } from '@shared/loans'
import { DatePicker } from '@renderer/components/DatePicker'
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
import { AccountSelect } from '@renderer/features/accounts/AccountSelect'
import { useAccounts } from '@renderer/features/accounts/queries'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { toast } from '@renderer/lib/toast'
import { useSettleLoan } from './queries'
import { directionLabels, owedLabel } from './wording'
import { t } from '@renderer/lib/i18n'

type How = 'repaid' | 'forgiven'

function SettleForm({
  loan,
  accounts,
  onClose
}: {
  loan: Loan
  accounts: Account[]
  onClose: () => void
}): React.JSX.Element {
  const money = useCurrency()
  const lent = loan.kind === 'lent'
  const usable = accounts.filter((a) => !a.isArchived)
  const rest = money.format(loan.outstanding)
  const [how, setHow] = useState<How>('repaid')
  const [accountId, setAccountId] = useState(() =>
    String(
      [loan.accountId].find((id) => usable.some((a) => a.id === id)) ??
        usable.find((a) => a.type === 'debit')?.id ??
        usable[0]?.id ??
        ''
    )
  )
  const [date, setDate] = useState<IsoDate>(today())
  const [formError, setFormError] = useState<string | null>(null)
  const settle = useSettleLoan()

  const options = [
    {
      value: 'repaid' as const,
      label: lent ? t('loans.paidTheRest', { name: loan.counterparty }) : t('loans.iPaidTheRest')
    },
    {
      value: 'forgiven' as const,
      label: lent ? t('loans.letTheRestGo') : t('loans.letItGo', { name: loan.counterparty })
    }
  ]

  const submit = (): void =>
    settle.mutate(
      {
        id: loan.id,
        input: how === 'repaid' ? { how, accountId: Number(accountId), date } : { how: 'forgiven' }
      },
      {
        onSuccess: () => {
          toast({ title: `${loan.title} closed`, variant: 'success' })
          onClose()
        },
        onError: (error) => setFormError(error.message)
      }
    )

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('loans.closeTitle', { title: loan.title })}</DialogTitle>
        <DialogDescription>
          {t('loans.howSettled', { owed: owedLabel(loan), rest })}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-5">
        <SegmentedControl
          name="settle-how"
          aria-label={t('loans.howItWasSettled')}
          value={how}
          options={options}
          onValueChange={(value) => {
            setHow(value)
            setFormError(null)
          }}
          className="justify-self-start"
        />
        {how === 'repaid' ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="grid content-start gap-1.5">
              <Label htmlFor="settle-account">
                {directionLabels(lent ? 'lent' : 'borrowed').repaymentAccount}
              </Label>
              <AccountSelect
                id="settle-account"
                value={accountId}
                accounts={usable}
                onChange={(value) => {
                  setAccountId(value)
                  setFormError(null)
                }}
              />
            </div>
            <div className="grid content-start gap-1.5">
              <Label htmlFor="settle-date">{t('common.date')}</Label>
              <DatePicker
                id="settle-date"
                value={date}
                min={loan.startDate}
                onChange={(value) => {
                  setDate(value)
                  setFormError(null)
                }}
              />
            </div>
            <p className="col-span-2 text-sm text-ink-muted">{t('loans.recordsFinal', { rest })}</p>
          </div>
        ) : (
          <p className="text-sm text-ink-muted">
            {lent ? t('loans.restNotPaid', { rest }) : t('loans.youWontPay', { rest })}
          </p>
        )}
      </div>

      {formError && <FormError message={formError} className="mt-5" />}

      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">{t('common.cancel')}</Button>
        </DialogClose>
        <Button disabled={settle.isPending || (how === 'repaid' && !accountId)} onClick={submit}>
          {t('loans.closeLoan2')}
        </Button>
      </DialogFooter>
    </>
  )
}

/** Closes a loan with something still owed: paid in full, or let go. */
export function SettleDialog({
  loan,
  onClose
}: {
  loan: Loan | null
  onClose: () => void
}): React.JSX.Element {
  const accounts = useAccounts()
  return (
    <Dialog open={loan !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[min(34rem,calc(100vw-2rem))]">
        {loan && accounts.data && (
          <SettleForm key={loan.id} loan={loan} accounts={accounts.data} onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
  )
}
