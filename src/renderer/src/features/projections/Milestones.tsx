import { Link } from 'react-router'
import { CreditCard, Landmark, PiggyBank, TriangleAlert, type LucideIcon } from 'lucide-react'
import { formatDate } from '@shared/dates'
import type { Milestone } from '@shared/projection'
import { Card, CardDescription, CardHeader, CardTitle } from '@renderer/components/ui/card'
import { useAccounts } from '@renderer/features/accounts/queries'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { cn } from '@renderer/lib/utils'

const looks: Record<Milestone['kind'], { icon: LucideIcon; tone: string }> = {
  loan_paid_off: { icon: Landmark, tone: 'bg-loan-soft text-loan' },
  plan_paid_off: { icon: CreditCard, tone: 'bg-loan-soft text-loan' },
  goal_reached: { icon: PiggyBank, tone: 'bg-savings-soft text-savings' },
  below_zero: { icon: TriangleAlert, tone: 'bg-expense-soft text-expense' }
}

function useText(milestone: Milestone): { text: string; to?: string } {
  const money = useCurrency()
  const accounts = useAccounts().data ?? []
  switch (milestone.kind) {
    case 'loan_paid_off':
      return { text: `${milestone.title} paid off`, to: `/loans/${milestone.sourceId}` }
    case 'plan_paid_off': {
      const card = accounts.find((a) => a.id === milestone.accountId)
      return {
        text: `${milestone.title} paid off${card ? ` on ${card.name}` : ''}`,
        to: card ? `/accounts/${card.id}` : undefined
      }
    }
    case 'goal_reached':
      return { text: `${milestone.title} reached`, to: `/savings/${milestone.sourceId}` }
    case 'below_zero':
      return { text: `Balance goes below zero: ${money.format(milestone.balance)}` }
  }
}

function MilestoneRow({ milestone }: { milestone: Milestone }): React.JSX.Element {
  const money = useCurrency()
  const { icon: Icon, tone } = looks[milestone.kind]
  const { text, to } = useText(milestone)
  const content = (
    <>
      <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', tone)}>
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn('block font-semibold', milestone.kind === 'below_zero' && 'text-expense')}
        >
          {text}
        </span>
        <span className="block text-sm text-ink-muted">
          {formatDate(milestone.date, money.locale, {
            weekday: 'short',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          })}
        </span>
      </span>
    </>
  )
  return (
    <li>
      {to ? (
        <Link
          to={to}
          className="flex items-center gap-3 rounded-control px-2 py-2 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary"
        >
          {content}
        </Link>
      ) : (
        <div className="flex items-center gap-3 px-2 py-2">{content}</div>
      )}
    </li>
  )
}

/** What happens along the way: loans and purchases paid off, goals reached, the balance dipping. */
export function Milestones({
  milestones,
  className
}: {
  milestones: Milestone[]
  className?: string
}): React.JSX.Element {
  return (
    <Card className={className}>
      <CardHeader>
        <div>
          <CardTitle>Milestones</CardTitle>
          <CardDescription>Along the way, if things go as planned.</CardDescription>
        </div>
      </CardHeader>
      {milestones.length === 0 ? (
        <p className="text-sm text-ink-muted">
          Nothing paid off or reached in this time, and the balance stays above zero.
        </p>
      ) : (
        <ul className="-mx-2 grid gap-0.5">
          {milestones.map((m) => (
            <MilestoneRow
              key={`${m.kind}-${'sourceId' in m ? m.sourceId : ''}-${m.date}`}
              milestone={m}
            />
          ))}
        </ul>
      )}
    </Card>
  )
}
