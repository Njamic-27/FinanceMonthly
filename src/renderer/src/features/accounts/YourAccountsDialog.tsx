import { useState } from 'react'
import { Plus } from 'lucide-react'
import { accountTypeLabels, type Account } from '@shared/accounts'
import type { BalanceTarget } from '@shared/adjustments'
import { formatDate, today } from '@shared/dates'
import { AmountInput } from '@renderer/components/AmountInput'
import { ColorChip } from '@renderer/components/ColorChip'
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
import { useCurrency } from '@renderer/hooks/useCurrency'
import { toast } from '@renderer/lib/toast'
import { cn } from '@renderer/lib/utils'
import { AccountDialog, type AccountDialogTarget } from './AccountDialog'
import { accountTypeIcons } from './appearance'
import { useAccounts, useAdjustBalances } from './queries'

/** What the field shows: the balance, or for a credit card what's owed on it. */
const shown = (account: Account): number =>
  account.type === 'credit' ? -account.balance : account.balance
const fromShown = (account: Account, value: number): number =>
  account.type === 'credit' ? -value : value

function AccountsForm({
  accounts,
  onAdd,
  onSaved
}: {
  accounts: Account[]
  onAdd: () => void
  onSaved: () => void
}): React.JSX.Element {
  const money = useCurrency()
  const now = today()
  // Only the fields you changed; the rest show today's balance.
  const [typed, setTyped] = useState<Record<number, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const adjust = useAdjustBalances()

  const rows = accounts.map((account) => {
    const text = typed[account.id]
    const parsed = text === undefined ? shown(account) : money.parse(text)
    const balance = parsed === null ? null : fromShown(account, parsed)
    return {
      account,
      text: text ?? money.toInput(shown(account)),
      balance,
      difference: balance === null ? 0 : balance - account.balance,
      opensLater: account.openingDate > now
    }
  })
  const invalid = rows.some((r) => r.balance === null)
  const changed = rows.filter((r) => r.difference !== 0)
  const total = rows.reduce((sum, r) => sum + (r.balance ?? r.account.balance), 0)

  const save = (event: React.FormEvent): void => {
    event.preventDefault()
    if (invalid) return
    if (changed.length === 0) return
    const targets: BalanceTarget[] = changed.map((r) => ({
      accountId: r.account.id,
      balance: r.balance ?? r.account.balance
    }))
    adjust.mutate(targets, {
      onSuccess: (added) => {
        toast({
          title: 'Balances updated',
          description:
            added.length === 1
              ? '1 balance adjustment added. It isn’t counted as income or spending.'
              : `${added.length} balance adjustments added. They aren’t counted as income or spending.`,
          variant: 'success'
        })
        onSaved()
      },
      onError: (error) => setFormError(error.message)
    })
  }

  return (
    <form onSubmit={save} noValidate>
      <DialogHeader>
        <DialogTitle>Your accounts</DialogTitle>
        <DialogDescription>
          Type what each account really has today. A difference is added as a balance adjustment,
          not counted as income or spending.
        </DialogDescription>
      </DialogHeader>

      {accounts.length === 0 ? (
        <p className="rounded-panel border border-dashed border-line p-6 text-ink-muted">
          No accounts yet. Add the cards and cash you pay with.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map(({ account, text, balance, difference, opensLater }) => {
            const id = `balance-${account.id}`
            return (
              <li key={account.id} className="flex items-center gap-3 py-3">
                <ColorChip color={account.color} icon={accountTypeIcons[account.type]} />
                <div className="min-w-0 flex-1">
                  <label htmlFor={id} className="block truncate font-semibold">
                    {account.name}
                  </label>
                  <p
                    id={`${id}-hint`}
                    className={cn(
                      'truncate text-sm text-ink-muted',
                      balance === null && 'text-expense'
                    )}
                  >
                    {opensLater
                      ? `Starts on ${formatDate(account.openingDate, money.locale)}`
                      : balance === null
                        ? 'Enter an amount, like 1250 or 1250.50'
                        : difference !== 0
                          ? `${money.format(difference, 'exceptZero')} adjustment`
                          : account.type !== 'credit'
                            ? accountTypeLabels[account.type]
                            : account.balance > 0
                              ? 'Credit card · in credit, so it shows as minus'
                              : 'Credit card · what you owe'}
                  </p>
                </div>
                <AmountInput
                  id={id}
                  className="w-44 shrink-0"
                  value={text}
                  disabled={opensLater || adjust.isPending}
                  aria-invalid={balance === null ? true : undefined}
                  aria-describedby={`${id}-hint`}
                  onChange={(event) => {
                    setTyped((current) => ({ ...current, [account.id]: event.target.value }))
                    setFormError(null)
                  }}
                />
              </li>
            )
          })}
        </ul>
      )}

      <div className="mt-2 flex items-baseline justify-between border-t border-line pt-3">
        <span className="font-semibold">Total balance</span>
        <span className={cn('amount text-lg', total < 0 && 'text-expense')}>
          {money.format(total)}
        </span>
      </div>

      {formError && <FormError message={formError} className="mt-4" />}

      <DialogFooter className="justify-between">
        <Button variant="ghost" onClick={onAdd} disabled={adjust.isPending}>
          <Plus />
          Add account or card
        </Button>
        <div className="flex gap-2">
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
          <Button type="submit" disabled={adjust.isPending || invalid || changed.length === 0}>
            {changed.length > 1 ? `Save ${changed.length} balances` : 'Save balance'}
          </Button>
        </div>
      </DialogFooter>
    </form>
  )
}

/**
 * Every account with its balance today, to correct by typing the real one: the total balance
 * on Month opens it. Adding an account or card starts here too.
 */
export function YourAccountsDialog({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}): React.JSX.Element {
  const all = useAccounts().data ?? []
  const active = all.filter((a) => !a.isArchived)
  const [adding, setAdding] = useState<AccountDialogTarget | null>(null)

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
        <DialogContent className="w-[min(36rem,calc(100vw-2rem))]">
          {open && (
            <AccountsForm
              accounts={active}
              onAdd={() => setAdding({ kind: 'new' })}
              onSaved={onClose}
            />
          )}
        </DialogContent>
      </Dialog>
      <AccountDialog target={adding} accounts={all} onClose={() => setAdding(null)} />
    </>
  )
}
