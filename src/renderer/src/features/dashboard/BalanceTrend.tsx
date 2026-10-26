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
import type { PeriodTotals } from '@shared/stats'
import { Card, CardDescription, CardHeader, CardTitle } from '@renderer/components/ui/card'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { cn } from '@renderer/lib/utils'

interface Point {
  date: IsoDate
  balance: number
}

const axisTick = { fill: 'var(--ink-muted)', fontSize: 12 }

/**
 * Total balance at the end of each day: one line, so the title names it and no legend is
 * needed. The last point is marked and labelled; every other day is on hover.
 */
export function BalanceTrend({
  days,
  className
}: {
  /** A day series ending today; `balance` is the total at the end of each day. */
  days: PeriodTotals[]
  className?: string
}): React.JSX.Element {
  const money = useCurrency()
  const data: Point[] = days.map((d) => ({ date: d.start, balance: d.balance }))
  const first = data[0]
  const last = data.at(-1)
  const change = first && last ? last.balance - first.balance : 0
  // Ticks on the first of each month.
  const monthStarts = data.filter((d) => d.date.endsWith('-01')).map((d) => d.date)
  const goesNegative = data.some((d) => d.balance < 0)
  const longDate = (date: IsoDate): string =>
    formatDate(date, money.locale, { weekday: 'short', day: 'numeric', month: 'long' })

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader>
        <div>
          <CardTitle>Balance</CardTitle>
          {first && (
            <CardDescription>
              {change === 0
                ? 'Unchanged'
                : `${change > 0 ? 'Up' : 'Down'} ${money.format(Math.abs(change))}`}{' '}
              since {formatDate(first.date, money.locale, { day: 'numeric', month: 'long' })}
            </CardDescription>
          )}
        </div>
      </CardHeader>

      {/* Fills the card when a taller neighbour stretches it; never shorter than minHeight. */}
      <div aria-hidden className="flex-1">
        <ResponsiveContainer width="100%" height="100%" minHeight={240}>
          <AreaChart data={data} margin={{ top: 24, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis
              dataKey="date"
              ticks={monthStarts}
              tickFormatter={(date: IsoDate) => formatDate(date, money.locale, { month: 'short' })}
              tick={axisTick}
              tickLine={false}
              axisLine={{ stroke: 'var(--line)' }}
            />
            <YAxis
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              width={60}
              domain={['auto', 'auto']}
              tickFormatter={(cents: number) => money.compact(cents)}
            />
            {goesNegative && <ReferenceLine y={0} stroke="var(--ink-muted)" />}
            <Tooltip
              cursor={{ stroke: 'var(--ink-muted)', strokeWidth: 1 }}
              isAnimationActive={false}
              content={({ active, payload }) => {
                const point = active ? (payload?.[0]?.payload as Point | undefined) : undefined
                if (!point) return null
                return (
                  <div className="rounded-control border border-line bg-surface px-3 py-2 shadow-float">
                    <p className="amount text-base">{money.format(point.balance)}</p>
                    <p className="text-sm text-ink-muted">{longDate(point.date)}</p>
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
              strokeLinecap="round"
              fill="var(--primary)"
              fillOpacity={0.1}
              activeDot={{ r: 5, fill: 'var(--primary)', stroke: 'var(--surface)', strokeWidth: 2 }}
              dot={(props: { cx?: number; cy?: number; index?: number }) =>
                props.index === data.length - 1 && last ? (
                  <g key="end">
                    <circle
                      cx={props.cx}
                      cy={props.cy}
                      r={4.5}
                      fill="var(--primary)"
                      stroke="var(--surface)"
                      strokeWidth={2}
                    />
                    <text
                      x={props.cx}
                      y={(props.cy ?? 0) - 12}
                      textAnchor="end"
                      fill="var(--ink)"
                      fontSize={12}
                      fontWeight={600}
                    >
                      {money.format(last.balance)}
                    </text>
                  </g>
                ) : (
                  <g key={props.index} />
                )
              }
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <table className="sr-only">
        <caption>Balance on the first of each month and today</caption>
        <tbody>
          {data
            .filter((d) => d.date.endsWith('-01') || d === last)
            .map((d) => (
              <tr key={d.date}>
                <th scope="row">{longDate(d.date)}</th>
                <td>{money.format(d.balance)}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </Card>
  )
}
