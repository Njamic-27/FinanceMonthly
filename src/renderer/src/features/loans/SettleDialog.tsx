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
      label: lent ? `${loan.counterparty} paid the rest` : 'I paid the rest'
    },
    {
      value: 'forgiven' as const,
      label: lent ? 'Let the rest go' : `${loan.counterparty} let it go`
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
        <DialogTitle>Close “{loan.title}”</DialogTitle>
        <DialogDescription>
          {owedLabel(loan)} {rest}. How was it settled?
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-5">
        <SegmentedControl
          name="settle-how"
          aria-label="How it was settled"
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
                {directionLabels[lent ? 'lent' : 'borrowed'].repaymentAccount}
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
              <Label htmlFor="settle-date">Date</Label>
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
            <p className="col-span-2 text-sm text-ink-muted">
              Records a final repayment of {rest}.
            </p>
          </div>
        ) : (
          <p className="text-sm text-ink-muted">
            {lent
              ? `The ${rest} that’s left won’t be paid back. No money moves; the loan is closed.`
              : `You won’t pay back the ${rest} that’s left. No money moves; the loan is closed.`}
          </p>
        )}
      </div>

      {formError && <FormError message={formError} className="mt-5" />}

      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">Cancel</Button>
        </DialogClose>
        <Button disabled={settle.isPending || (how === 'repaid' && !accountId)} onClick={submit}>
          Close loan
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
