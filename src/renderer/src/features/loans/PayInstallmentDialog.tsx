import { useState } from 'react'
import type { Account } from '@shared/accounts'
import { formatDate, today, type IsoDate } from '@shared/dates'
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
import { AccountSelect } from '@renderer/features/accounts/AccountSelect'
import { useAccounts } from '@renderer/features/accounts/queries'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { toast } from '@renderer/lib/toast'
import { usePayInstallment } from './queries'

/** The installment to pay, from a loan's schedule or the Calendar. */
export interface PayInstallmentTarget {
  installmentId: number
  /** "Car loan (3/48)". */
  title: string
  amount: number
  dueDate: IsoDate
  /** The loan's account, the default to pay from. */
  accountId: number | null
}

function PayForm({
  target,
  accounts,
  onClose
}: {
  target: PayInstallmentTarget
  accounts: Account[]
  onClose: () => void
}): React.JSX.Element {
  const money = useCurrency()
  const usable = accounts.filter((a) => !a.isArchived || a.id === target.accountId)
  const [accountId, setAccountId] = useState(() =>
    String(
      [target.accountId].find((id) => usable.some((a) => a.id === id)) ??
        usable.find((a) => a.type === 'debit')?.id ??
        ''
    )
  )
  // Paid early means paid today; a late one usually went out on its due date.
  const [date, setDate] = useState<IsoDate>(() => {
    const now = today()
    return target.dueDate > now ? now : target.dueDate
  })
  const [formError, setFormError] = useState<string | null>(null)
  const pay = usePayInstallment()

  const submit = (): void =>
    pay.mutate(
      { installmentId: target.installmentId, input: { accountId: Number(accountId), date } },
      {
        onSuccess: () => {
          toast({
            title: `${target.title} paid`,
            description: `${money.format(target.amount)} on ${formatDate(date, money.locale)}`,
            variant: 'success'
          })
          onClose()
        },
        onError: (error) => setFormError(error.message)
      }
    )

  return (
    <>
      <DialogHeader>
        <DialogTitle>Pay {target.title}</DialogTitle>
        <DialogDescription>
          {money.format(target.amount)}, due{' '}
          {formatDate(target.dueDate, money.locale, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          })}
          . The amount is set by the loan’s schedule.
        </DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid content-start gap-1.5">
          <Label htmlFor="pay-account">Paid from</Label>
          <AccountSelect
            id="pay-account"
            value={accountId}
            accounts={usable}
            onChange={(value) => {
              setAccountId(value)
              setFormError(null)
            }}
          />
        </div>
        <div className="grid content-start gap-1.5">
          <Label htmlFor="pay-date">Paid on</Label>
          <DatePicker
            id="pay-date"
            value={date}
            onChange={(value) => {
              setDate(value)
              setFormError(null)
            }}
          />
        </div>
      </div>
      {formError && <FormError message={formError} className="mt-5" />}
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">Cancel</Button>
        </DialogClose>
        <Button disabled={pay.isPending || !accountId} onClick={submit}>
          Mark as paid
        </Button>
      </DialogFooter>
    </>
  )
}

/** Pays one bank loan installment. */
export function PayInstallmentDialog({
  target,
  onClose
}: {
  target: PayInstallmentTarget | null
  onClose: () => void
}): React.JSX.Element {
  const accounts = useAccounts()
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[min(32rem,calc(100vw-2rem))]">
        {target && accounts.data && (
          <PayForm
            key={target.installmentId}
            target={target}
            accounts={accounts.data}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
