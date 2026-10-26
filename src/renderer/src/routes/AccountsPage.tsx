import { useState } from 'react'
import { Plus, Wallet } from 'lucide-react'
import { accountTypeLabels, type Account } from '@shared/accounts'
import { ColorChip } from '@renderer/components/ColorChip'
import { PageHeader } from '@renderer/components/PageHeader'
import { Button } from '@renderer/components/ui/button'
import { Card, CardDescription, CardTitle } from '@renderer/components/ui/card'
import { AccountDialog, type AccountDialogTarget } from '@renderer/features/accounts/AccountDialog'
import { accountTypeIcons } from '@renderer/features/accounts/appearance'
import { BalanceBanner } from '@renderer/features/accounts/BalanceBanner'
import { useAccounts, useArchiveAccount } from '@renderer/features/accounts/queries'
import { openTransactionDialog } from '@renderer/features/transactions/dialogStore'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { toast } from '@renderer/lib/toast'
import { cn } from '@renderer/lib/utils'

function CreditUsage({ account }: { account: Account }): React.JSX.Element {
  const money = useCurrency()
  const limit = account.creditLimit ?? 0
  const owed = Math.max(0, -account.balance)
  const share = limit > 0 ? Math.min(1, owed / limit) : 0
  const over = owed - limit

  return (
    <div className="mt-4">
      <div
        role="meter"
        aria-label="Credit used"
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={Math.min(owed, limit)}
        aria-valuetext={`${money.format(owed)} of ${money.format(limit)}`}
        className="h-2 overflow-hidden rounded-full bg-surface-2"
      >
        <div className="h-full rounded-full bg-loan" style={{ width: `${share * 100}%` }} />
      </div>
      <p className={cn('mt-2 text-sm text-ink-muted', over > 0 && 'text-expense')}>
        {over > 0
          ? `Over the limit by ${money.format(over)}`
          : `${money.format(account.available ?? 0)} available of ${money.format(limit)}`}
      </p>
    </div>
  )
}

function AccountCard({
  account,
  payFrom,
  onOpen
}: {
  account: Account
  /** The account a card payment comes from by default. */
  payFrom?: Account
  onOpen: () => void
}): React.JSX.Element {
  const money = useCurrency()
  const isCredit = account.type === 'credit'
  const figure = isCredit ? Math.max(0, -account.balance) : account.balance
  const caption = isCredit
    ? account.balance > 0
      ? 'In credit'
      : 'Owed'
    : account.balance < 0
      ? 'Overdrawn'
      : 'Balance'

  const owed = isCredit ? Math.max(0, -account.balance) : 0

  return (
    <div className="flex flex-col rounded-panel border border-line bg-surface text-ink transition-colors hover:border-ink-muted/40">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Edit ${account.name}`}
        className="flex flex-1 cursor-pointer flex-col rounded-panel p-5 text-left focus-visible:outline-2 focus-visible:outline-primary"
      >
        <span className="flex items-center gap-3">
          <ColorChip color={account.color} icon={accountTypeIcons[account.type]} />
          <span className="min-w-0">
            <span className="block truncate font-semibold">{account.name}</span>
            <span className="block text-sm text-ink-muted">{accountTypeLabels[account.type]}</span>
          </span>
        </span>
        <span className="mt-6 block text-sm text-ink-muted">{caption}</span>
        <span
          className={cn(
            'amount block text-title',
            !isCredit && account.balance < 0 && 'text-expense'
          )}
        >
          {money.format(isCredit && account.balance > 0 ? account.balance : figure)}
        </span>
        {isCredit && <CreditUsage account={account} />}
      </button>
      {owed > 0 && (
        <div className="-mt-1 px-5 pb-5">
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              openTransactionDialog({
                kind: 'new',
                prefill: {
                  type: 'transfer',
                  accountId: payFrom?.id,
                  toAccountId: account.id,
                  amount: owed
                }
              })
            }
          >
            Pay card
          </Button>
        </div>
      )}
    </div>
  )
}

export function AccountsPage(): React.JSX.Element {
  const accounts = useAccounts()
  const archiveAccount = useArchiveAccount()
  const money = useCurrency()
  const [dialog, setDialog] = useState<AccountDialogTarget | null>(null)
  const all = accounts.data ?? []
  const active = all.filter((a) => !a.isArchived)
  const archived = all.filter((a) => a.isArchived)

  const restore = (account: Account): void =>
    archiveAccount.mutate(
      { id: account.id, archived: false },
      {
        onSuccess: () => toast({ title: `${account.name} restored`, variant: 'success' }),
        onError: (error) =>
          toast({ title: 'Account not restored', description: error.message, variant: 'error' })
      }
    )

  return (
    <>
      <PageHeader
        title="Accounts"
        description="Debit cards, credit cards and cash."
        actions={
          active.length > 0 && (
            <Button onClick={() => setDialog({ kind: 'new' })}>
              <Plus />
              Add account
            </Button>
          )
        }
      />

      {accounts.isError && (
        <Card className="max-w-3xl">
          <CardTitle>Accounts could not be loaded</CardTitle>
          <CardDescription className="mt-1">
            {accounts.error.message} Restart Financije to try again.
          </CardDescription>
        </Card>
      )}

      {accounts.isSuccess && active.length === 0 && (
        <section className="flex max-w-2xl flex-col items-start gap-4 rounded-panel border border-dashed border-line p-8">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Wallet className="size-6" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">Add the accounts you pay with</h2>
            <p className="mt-1 text-ink-muted">
              Your debit cards, credit cards and cash, with what’s on each of them today. Every
              transaction then comes from or goes to one of them.
            </p>
          </div>
          <Button onClick={() => setDialog({ kind: 'new' })}>
            <Plus />
            Add your first account
          </Button>
        </section>
      )}

      {active.length > 0 && (
        <>
          <BalanceBanner accounts={active} className="mb-8" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                payFrom={active.find((a) => a.type === 'debit')}
                onOpen={() => setDialog({ kind: 'edit', account })}
              />
            ))}
          </div>
        </>
      )}

      {archived.length > 0 && (
        <section className="mt-10 max-w-3xl">
          <h2 className="mb-1 text-lg font-semibold">Archived</h2>
          <p className="mb-3 text-sm text-ink-muted">
            Left out of totals and new transactions. Their history stays.
          </p>
          <Card className="p-3">
            <ul className="divide-y divide-line">
              {archived.map((account) => (
                <li
                  key={account.id}
                  className="flex items-center gap-2 py-1.5 first:pt-0 last:pb-0"
                >
                  <button
                    type="button"
                    onClick={() => setDialog({ kind: 'edit', account })}
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-control px-2 py-1.5 text-left transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <ColorChip color={account.color} icon={accountTypeIcons[account.type]} />
                    <span className="min-w-0 flex-1 truncate font-semibold">{account.name}</span>
                    <span className="amount text-sm text-ink-muted">
                      {money.format(account.balance)}
                    </span>
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={archiveAccount.isPending}
                    onClick={() => restore(account)}
                  >
                    Restore
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      <AccountDialog target={dialog} accounts={all} onClose={() => setDialog(null)} />
    </>
  )
}
