import { Link } from 'react-router'
import type { Account } from '@shared/accounts'
import { formatDate, today } from '@shared/dates'
import { goalShare } from '@shared/savings'
import { ColorChip } from '@renderer/components/ColorChip'
import { Card, CardDescription, CardHeader, CardTitle } from '@renderer/components/ui/card'
import { accountTypeIcons } from '@renderer/features/accounts/appearance'
import { CreditUsage } from '@renderer/features/accounts/CreditUsage'
import { useCardStatus } from '@renderer/features/accounts/queries'
import { goalOutlook } from '@renderer/features/savings/outlook'
import { ProgressRing } from '@renderer/features/savings/ProgressRing'
import { useSavingsGoals } from '@renderer/features/savings/queries'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { cn } from '@renderer/lib/utils'

const rowLink =
  'flex items-center gap-3 rounded-control px-2 py-2.5 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary'

/** Each active savings goal: how far along it is, and where it's heading. */
export function GoalsCard({ className }: { className?: string }): React.JSX.Element | null {
  const money = useCurrency()
  const goals = (useSavingsGoals().data ?? []).filter((g) => !g.isArchived)
  if (goals.length === 0) return null
  const now = today()

  return (
    <Card className={className}>
      <CardHeader>
        <div>
          <CardTitle>Savings goals</CardTitle>
          <CardDescription>How close you are.</CardDescription>
        </div>
      </CardHeader>
      <ul className="-mx-2 grid gap-0.5">
        {goals.map((goal) => {
          const share = goalShare(goal)
          return (
            <li key={goal.id}>
              <Link to={`/savings/${goal.id}`} className={rowLink}>
                <ProgressRing
                  share={share}
                  size={48}
                  label={`${Math.floor(share * 100)}% of ${money.format(goal.targetAmount)} saved`}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="truncate font-semibold">{goal.name}</span>
                    <span className="amount shrink-0 text-sm">
                      {money.format(goal.saved)}{' '}
                      <span className="text-ink-muted">of {money.format(goal.targetAmount)}</span>
                    </span>
                  </span>
                  <span className="block truncate text-sm text-ink-muted">
                    {goalOutlook(goal, now, money)}
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

function CardRow({ account }: { account: Account }): React.JSX.Element {
  const money = useCurrency()
  const status = useCardStatus(account.id).data
  const owed = Math.max(0, -account.balance)
  const due = status?.cycle.dueDate
  return (
    <li>
      <Link to={`/accounts/${account.id}`} className={cn(rowLink, 'items-start')}>
        <ColorChip color={account.color} icon={accountTypeIcons.credit} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-3">
            <span className="truncate font-semibold">{account.name}</span>
            <span className="amount shrink-0 text-sm">{money.format(owed)} owed</span>
          </span>
          <CreditUsage
            className="mt-2"
            owed={owed}
            reserved={account.reserved ?? 0}
            limit={account.creditLimit ?? 0}
            available={account.available ?? 0}
          />
          {due && status?.leftToPay !== null && status?.leftToPay !== undefined && (
            <span className="block text-sm text-ink-muted">
              {status.leftToPay > 0
                ? `${money.format(status.leftToPay)} due ${formatDate(due, money.locale, { day: 'numeric', month: 'short' })}`
                : `Statement paid · next due ${formatDate(due, money.locale, { day: 'numeric', month: 'short' })}`}
            </span>
          )}
        </span>
      </Link>
    </li>
  )
}

/** Each credit card: what's owed against the limit, and the next payment. */
export function CardsCard({
  accounts,
  className
}: {
  accounts: Account[]
  className?: string
}): React.JSX.Element | null {
  const cards = accounts.filter((a) => a.type === 'credit' && !a.isArchived)
  if (cards.length === 0) return null
  return (
    <Card className={className}>
      <CardHeader>
        <div>
          <CardTitle>Credit cards</CardTitle>
          <CardDescription>What’s used of each limit.</CardDescription>
        </div>
      </CardHeader>
      <ul className="-mx-2 grid gap-0.5">
        {cards.map((card) => (
          <CardRow key={card.id} account={card} />
        ))}
      </ul>
    </Card>
  )
}
