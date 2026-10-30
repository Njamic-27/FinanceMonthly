import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Plus, Wallet } from 'lucide-react'
import { accountTypeLabels, type Account } from '@shared/accounts'
import { ColorChip } from '@renderer/components/ColorChip'
import { PageHeader } from '@renderer/components/PageHeader'
import { Button } from '@renderer/components/ui/button'
import { Card, CardDescription, CardTitle } from '@renderer/components/ui/card'
import { AccountDialog, type AccountDialogTarget } from '@renderer/features/accounts/AccountDialog'
import { accountTypeIcons } from '@renderer/features/accounts/appearance'
import { BalanceBanner } from '@renderer/features/accounts/BalanceBanner'
import { CreditUsage } from '@renderer/features/accounts/CreditUsage'
import { useAccounts, useArchiveAccount } from '@renderer/features/accounts/queries'
import { openTransactionDialog } from '@renderer/features/transactions/dialogStore'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { accountPath } from '@renderer/lib/links'
import { toast } from '@renderer/lib/toast'
import { cn } from '@renderer/lib/utils'
import { t } from '@renderer/lib/i18n'

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
      ? t('accounts.inCredit')
      : t('accounts.owed')
    : account.balance < 0
      ? t('accounts.overdrawn')
      : t('accounts.balance')

  const owed = isCredit ? Math.max(0, -account.balance) : 0

  return (
    <div className="flex flex-col rounded-panel border border-line bg-surface text-ink transition-colors hover:bg-surface-2">
      <button
        type="button"
        onClick={onOpen}
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
        {isCredit && (
          <CreditUsage
            className="mt-4"
            owed={Math.max(0, -account.balance)}
            reserved={account.reserved ?? 0}
            limit={account.creditLimit ?? 0}
            available={account.available ?? 0}
          />
        )}
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
            {t('accounts.payCard')}
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
  const navigate = useNavigate()
  const all = accounts.data ?? []
  const active = all.filter((a) => !a.isArchived)
  const archived = all.filter((a) => a.isArchived)

  const restore = (account: Account): void =>
    archiveAccount.mutate(
      { id: account.id, archived: false },
      {
        onSuccess: () => toast({ title: `${account.name} restored`, variant: 'success' }),
        onError: (error) =>
          toast({
            title: t('accounts.accountNotRestored'),
            description: error.message,
            variant: 'error'
          })
      }
    )

  return (
    <>
      <PageHeader
        title={t('screen.accounts')}
        description={t('accounts.debitCardsCreditCards')}
        actions={
          active.length > 0 && (
            <Button onClick={() => setDialog({ kind: 'new' })}>
              <Plus />
              {t('accounts.addAccount')}
            </Button>
          )
        }
      />

      {accounts.isError && (
        <Card className="max-w-3xl">
          <CardTitle>{t('accounts.accountsCouldNotBe')}</CardTitle>
          <CardDescription className="mt-1">
            {t('common.restart', { error: accounts.error.message })}
          </CardDescription>
        </Card>
      )}

      {accounts.isSuccess && active.length === 0 && (
        <section className="flex max-w-2xl flex-col items-start gap-4 rounded-panel border border-dashed border-line p-8">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Wallet className="size-6" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">{t('accounts.addTheAccountsYou')}</h2>
            <p className="mt-1 text-ink-muted">{t('accounts.yourDebitCardsCredit')}</p>
          </div>
          <Button onClick={() => setDialog({ kind: 'new' })}>
            <Plus />
            {t('accounts.addYourFirstAccount')}
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
                onOpen={() => navigate(accountPath(account.id))}
              />
            ))}
          </div>
        </>
      )}

      {archived.length > 0 && (
        <section className="mt-10 max-w-3xl">
          <h2 className="mb-1 text-lg font-semibold">{t('accounts.archived')}</h2>
          <p className="mb-3 text-sm text-ink-muted">{t('accounts.leftOutOfTotals')}</p>
          <Card className="p-3">
            <ul className="divide-y divide-line">
              {archived.map((account) => (
                <li
                  key={account.id}
                  className="flex items-center gap-2 py-1.5 first:pt-0 last:pb-0"
                >
                  <button
                    type="button"
                    onClick={() => navigate(accountPath(account.id))}
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-control px-2 py-1.5 text-left link-row"
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
                    {t('accounts.restore')}
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
