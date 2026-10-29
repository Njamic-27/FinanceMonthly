import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { Account, AccountType } from '@shared/accounts'
import type { AccountSpending, MonthKey } from '@shared/month'
import { ColorChip } from '@renderer/components/ColorChip'
import { Card } from '@renderer/components/ui/card'
import { accountTypeIcons } from '@renderer/features/accounts/appearance'
import { useAccounts } from '@renderer/features/accounts/queries'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { cn } from '@renderer/lib/utils'
import { AccountSpendingDialog } from './AccountSpendingDialog'
import { useSpendingByAccount } from './queries'

const groupTitles: { type: AccountType; title: string }[] = [
  { type: 'debit', title: 'Debit cards' },
  { type: 'cash', title: 'Cash' },
  { type: 'credit', title: 'Credit cards' }
]

const totalOf = (s: AccountSpending): number => s.recorded + s.planned

/**
 * The month's spending by payment method (PLAN.md step 46): debit cards, cash and credit cards,
 * each account's total under its group's. Counted like the rest of the sheet (a card's is what
 * its bill due this month brings), so the groups add up to the month's expenses. A group
 * folds away on a click; an account opens its transactions.
 */
export function PaymentMethodView({ month }: { month: MonthKey }): React.JSX.Element {
  const money = useCurrency()
  const accounts = useAccounts().data ?? []
  const spending = useSpendingByAccount(month).data ?? []
  const [folded, setFolded] = useState<Set<AccountType>>(() => new Set())
  const [open, setOpen] = useState<Account | null>(null)
  // Looked up again in fresh data, so the popup's total follows edits made in it.
  const openSpending = open && spending.find((s) => s.accountId === open.id)

  const groups = groupTitles
    .map(({ type, title }) => {
      const rows = spending
        .map((s) => ({ spending: s, account: accounts.find((a) => a.id === s.accountId) }))
        .filter(
          (r): r is { spending: AccountSpending; account: Account } =>
            r.account?.type === type && totalOf(r.spending) > 0
        )
        .sort((a, b) => totalOf(b.spending) - totalOf(a.spending))
      return { type, title, rows, total: rows.reduce((sum, r) => sum + totalOf(r.spending), 0) }
    })
    .filter((g) => g.rows.length > 0)

  const toggle = (type: AccountType): void =>
    setFolded((current) => {
      const next = new Set(current)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })

  if (groups.length === 0) {
    return <p className="px-1 text-ink-muted">Nothing spent this month yet.</p>
  }

  return (
    <>
      {groups.map((group) => {
        const isOpen = !folded.has(group.type)
        const listId = `month-method-${group.type}`
        return (
          <Card key={group.type} className="p-0">
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={listId}
              onClick={() => toggle(group.type)}
              className="flex w-full cursor-pointer items-center gap-3 rounded-panel px-5 py-4 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
            >
              <ChevronDown
                className={cn(
                  'size-5 shrink-0 text-ink-muted transition-transform motion-reduce:transition-none',
                  !isOpen && '-rotate-90'
                )}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-semibold">{group.title}</span>
                {group.type === 'credit' && (
                  <span className="block text-sm text-ink-muted">
                    What this month’s bills bring: purchases from each card’s last cycle
                  </span>
                )}
              </span>
              <span className="amount text-lg">{money.format(group.total)}</span>
            </button>
            {isOpen && (
              <ul id={listId} className="border-t border-line px-2 py-2">
                {group.rows.map(({ account, spending: s }) => (
                  <li key={account.id}>
                    <button
                      type="button"
                      onClick={() => setOpen(account)}
                      className="link-row flex w-full items-center gap-3 px-3 py-2 text-left"
                    >
                      <ColorChip color={account.color} icon={accountTypeIcons[account.type]} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{account.name}</span>
                        <span className="block truncate text-sm text-ink-muted">
                          {[
                            s.count === 1
                              ? '1 transaction'
                              : s.count > 1 && `${s.count} transactions`,
                            s.planned > 0 && `${money.format(s.planned)} still planned`
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </span>
                      <span className="amount shrink-0">{money.format(totalOf(s))}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )
      })}
      <AccountSpendingDialog
        month={month}
        account={open}
        spending={openSpending ?? { accountId: open?.id ?? 0, recorded: 0, planned: 0, count: 0 }}
        onClose={() => setOpen(null)}
      />
    </>
  )
}
