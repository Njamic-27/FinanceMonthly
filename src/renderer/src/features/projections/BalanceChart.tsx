import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { formatDate, type IsoDate } from '@shared/dates'
import type { ProjectionResult } from '@shared/projection'
import { Card, CardDescription, CardHeader, CardTitle } from '@renderer/components/ui/card'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { cn } from '@renderer/lib/utils'
import { periodLabel, periodTick } from './labels'

interface Point {
  date: IsoDate
  tick: string
  label: string
  balance: number
}

const axisTick = { fill: 'var(--ink-muted)', fontSize: 12 }

/**
 * The projected total balance: today, then the end of each week or month. One line, so the
 * title names it; below zero the zero line shows.
 */
export function BalanceChart({
  projection,
  className
}: {
  projection: ProjectionResult
  className?: string
}): React.JSX.Element {
  const money = useCurrency()
  const today = projection.periods[0]?.start
  const data: Point[] = [
    {
      date: today,
      tick: 'Today',
      label: 'Today',
      balance: projection.startBalance
    },
    ...projection.periods.map((p) => ({
      date: p.end,
      tick: periodTick(p, projection.granularity, money.locale),
      label: `End of ${periodLabel(p, projection.granularity, money.locale)}`,
      balance: p.balance
    }))
  ]
  const goesNegative = data.some((d) => d.balance < 0)
  const change = projection.endBalance - projection.startBalance

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader>
        <div>
          <CardTitle>Projected balance</CardTitle>
          <CardDescription>
            {change === 0
              ? 'No change'
              : `${change > 0 ? 'Up' : 'Down'} ${money.format(Math.abs(change))}`}{' '}
            by {formatDate(projection.periods.at(-1)?.end ?? today, money.locale)}
          </CardDescription>
        </div>
      </CardHeader>
      <div aria-hidden className="flex-1">
        <ResponsiveContainer width="100%" height="100%" minHeight={280}>
          <AreaChart data={data} margin={{ top: 16, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis
              dataKey="tick"
              tick={axisTick}
              tickLine={false}
              axisLine={{ stroke: 'var(--line)' }}
              interval="preserveStartEnd"
              minTickGap={16}
            />
            <YAxis
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              width={64}
              domain={['auto', 'auto']}
              tickFormatter={(cents: number) => money.compact(cents)}
            />
            {goesNegative && <ReferenceLine y={0} stroke="var(--expense)" strokeDasharray="4 4" />}
            <Tooltip
              cursor={{ stroke: 'var(--ink-muted)', strokeWidth: 1 }}
              isAnimationActive={false}
              content={({ active, payload }) => {
                const point = active ? (payload?.[0]?.payload as Point | undefined) : undefined
                if (!point) return null
                return (
                  <div className="rounded-control border border-line bg-surface px-3 py-2 shadow-float">
                    <p className={cn('amount text-base', point.balance < 0 && 'text-expense')}>
                      {money.format(point.balance)}
                    </p>
                    <p className="text-sm text-ink-muted">{point.label}</p>
                  </div>
                )
              }}
            />
            <Area
              type="linear"
              dataKey="balance"
              stroke="var(--primary)"
              strokeWidth={2}
              strokeLinejoin="round"
              fill="var(--primary)"
              fillOpacity={0.1}
              dot={false}
              activeDot={{ r: 5, fill: 'var(--primary)', stroke: 'var(--surface)', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
