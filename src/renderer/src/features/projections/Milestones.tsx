import { Link } from 'react-router'
import { CreditCard, Landmark, PiggyBank, TriangleAlert, type LucideIcon } from 'lucide-react'
import { formatDate } from '@shared/dates'
import type { Milestone } from '@shared/projection'
import { Card, CardDescription, CardHeader, CardTitle } from '@renderer/components/ui/card'
import { useAccounts } from '@renderer/features/accounts/queries'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { dayPath, milestonePath } from '@renderer/lib/links'
import { cn } from '@renderer/lib/utils'
import { t } from '@renderer/lib/i18n'

const looks: Record<Milestone['kind'], { icon: LucideIcon; tone: string }> = {
  loan_paid_off: { icon: Landmark, tone: 'bg-loan-soft text-loan' },
  plan_paid_off: { icon: CreditCard, tone: 'bg-loan-soft text-loan' },
  goal_reached: { icon: PiggyBank, tone: 'bg-savings-soft text-savings' },
  below_zero: { icon: TriangleAlert, tone: 'bg-expense-soft text-expense' }
}

function useText(milestone: Milestone): string {
  const money = useCurrency()
  const accounts = useAccounts().data ?? []
  switch (milestone.kind) {
    case 'loan_paid_off':
      return t('projections.paidOff', { title: milestone.title })
    case 'plan_paid_off': {
      const card = accounts.find((a) => a.id === milestone.accountId)
      return card
        ? t('projections.paidOffOn', { title: milestone.title, card: card.name })
        : t('projections.paidOff', { title: milestone.title })
    }
    case 'goal_reached':
      return t('projections.reached', { title: milestone.title })
    case 'below_zero':
      return t('projections.belowZero', { amount: money.format(milestone.balance) })
  }
}

function MilestoneRow({ milestone }: { milestone: Milestone }): React.JSX.Element {
  const money = useCurrency()
  const { icon: Icon, tone } = looks[milestone.kind]
  const text = useText(milestone)
  const date = formatDate(milestone.date, money.locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
  // The row opens what the milestone is about; its date opens that day in the Calendar.
  const onItsDay = milestone.kind === 'below_zero'
  return (
    <li className="link-row relative flex items-center gap-3 px-2 py-2">
      <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', tone)}>
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <Link
          to={milestonePath(milestone)}
          className={cn('link-cover block font-semibold', onItsDay && 'text-expense')}
        >
          {text}
        </Link>
        <span className="block text-sm text-ink-muted">
          {onItsDay ? (
            date
          ) : (
            <Link to={dayPath(milestone.date)} className="link">
              {date}
            </Link>
          )}
        </span>
      </span>
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
          <CardTitle>{t('projections.milestones')}</CardTitle>
          <CardDescription>{t('projections.alongTheWayIf')}</CardDescription>
        </div>
      </CardHeader>
      {milestones.length === 0 ? (
        <p className="text-sm text-ink-muted">{t('projections.nothingPaidOffOr')}</p>
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
