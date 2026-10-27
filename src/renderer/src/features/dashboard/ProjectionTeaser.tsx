import { Link } from 'react-router'
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, YAxis } from 'recharts'
import { formatDate } from '@shared/dates'
import type { Milestone } from '@shared/projection'
import { Card, CardDescription, CardHeader, CardTitle } from '@renderer/components/ui/card'
import { useProjection } from '@renderer/features/projections/queries'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { cn } from '@renderer/lib/utils'

function milestoneText(m: Milestone): string {
  switch (m.kind) {
    case 'loan_paid_off':
    case 'plan_paid_off':
      return `${m.title} paid off`
    case 'goal_reached':
      return `${m.title} reached`
    case 'below_zero':
      return 'Balance goes below zero'
  }
}

/** The next 12 months in brief: where the balance ends up, and the first thing to watch. */
export function ProjectionTeaser({ className }: { className?: string }): React.JSX.Element {
  const money = useCurrency()
  const projection = useProjection({ months: 12, granularity: 'month' })
  const data = projection.data
  const points = data
    ? [{ balance: data.startBalance }, ...data.periods.map((p) => ({ balance: p.balance }))]
    : []
  const change = data ? data.endBalance - data.startBalance : 0
  // A dip below zero matters most; otherwise the next thing that happens.
  const next = data && (data.milestones.find((m) => m.kind === 'below_zero') ?? data.milestones[0])

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader>
        <div>
          <CardTitle>The next 12 months</CardTitle>
          <CardDescription>If things go as planned.</CardDescription>
        </div>
        <Link
          to="/projections"
          className="rounded-control text-sm font-semibold whitespace-nowrap text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
        >
          Projections
        </Link>
      </CardHeader>
      {data && (
        <>
          <div>
            <p className="text-sm text-ink-muted">
              In{' '}
              {formatDate(data.periods.at(-1)?.end ?? '', money.locale, {
                month: 'long',
                year: 'numeric'
              })}
            </p>
            <p className={cn('amount text-amount', data.endBalance < 0 && 'text-expense')}>
              {money.format(data.endBalance)}
            </p>
            <p className="text-sm text-ink-muted">
              {money.format(change, 'exceptZero')} from today
            </p>
          </div>
          {/* The trend only; the Projections screen has the axes, numbers and table. */}
          <div aria-hidden className="mt-3 h-20">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 4, right: 0, bottom: 4, left: 0 }}>
                <YAxis hide domain={['auto', 'auto']} />
                {points.some((p) => p.balance < 0) && (
                  <ReferenceLine y={0} stroke="var(--expense)" strokeDasharray="4 4" />
                )}
                <Area
                  type="linear"
                  dataKey="balance"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  fill="var(--primary)"
                  fillOpacity={0.1}
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {next && (
            <p
              className={cn(
                'mt-3 border-t border-line pt-3 text-sm',
                next.kind === 'below_zero' ? 'font-semibold text-expense' : 'text-ink-muted'
              )}
            >
              {milestoneText(next)} ·{' '}
              {formatDate(next.date, money.locale, {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              })}
            </p>
          )}
        </>
      )}
    </Card>
  )
}
