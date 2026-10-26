import { useNavigate } from 'react-router'
import {
  Bar,
  BarChart,
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
import { overviewParams } from '@renderer/features/overview/period'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { cn } from '@renderer/lib/utils'

interface Month {
  start: IsoDate
  tick: string
  income: number
  /** Negative, so spending hangs below the baseline. */
  spent: number
  net: number
}

const axisTick = { fill: 'var(--ink-muted)', fontSize: 12 }

function LegendKey({ color, label }: { color: string; label: string }): React.JSX.Element {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className="size-3 rounded-[3px]" style={{ background: color }} />
      {label}
    </span>
  )
}

/**
 * Income above the line and spending below it, month by month. Position tells them apart,
 * so the chart doesn't rely on green and red alone (they're too close for some colour-blind
 * eyes). Clicking a month opens it in Overview.
 */
export function IncomeSpendingChart({
  months,
  title,
  className
}: {
  months: PeriodTotals[]
  title: string
  className?: string
}): React.JSX.Element {
  const money = useCurrency()
  const navigate = useNavigate()
  const data: Month[] = months.map((m) => ({
    start: m.start,
    tick: formatDate(m.start, money.locale, { month: 'short' }),
    income: m.income,
    spent: -m.expenses,
    net: m.net
  }))
  const open = (start: IsoDate): void => {
    navigate(`/overview?${overviewParams('month', start)}`)
  }

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader className="flex-wrap">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            Income above the line, spending below. Click a month to open it.
          </CardDescription>
        </div>
        <p className="flex gap-4 text-sm text-ink-muted">
          <LegendKey color="var(--income)" label="Income" />
          <LegendKey color="var(--expense)" label="Spending" />
        </p>
      </CardHeader>

      {/* Fills the card when a taller neighbour stretches it; never shorter than minHeight. */}
      <div aria-hidden className="flex-1">
        <ResponsiveContainer width="100%" height="100%" minHeight={288}>
          <BarChart
            data={data}
            stackOffset="sign"
            margin={{ top: 8, right: 4, bottom: 0, left: 0 }}
            onClick={(state) => {
              const month = data[Number(state.activeTooltipIndex)]
              if (month) open(month.start)
            }}
            className="cursor-pointer"
          >
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="tick" tick={axisTick} tickLine={false} axisLine={false} />
            <YAxis
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              width={60}
              allowDecimals={false}
              tickFormatter={(cents: number) => money.compact(Math.abs(cents))}
            />
            <ReferenceLine y={0} stroke="var(--ink-muted)" />
            <Tooltip
              cursor={{ fill: 'var(--surface-2)' }}
              isAnimationActive={false}
              content={({ active, payload }) => {
                const month = active ? (payload?.[0]?.payload as Month | undefined) : undefined
                if (!month) return null
                return (
                  <div className="grid gap-1 rounded-control border border-line bg-surface px-3 py-2 shadow-float">
                    <p className="text-sm text-ink-muted">
                      {formatDate(month.start, money.locale, { month: 'long', year: 'numeric' })}
                    </p>
                    {(
                      [
                        ['Income', month.income, 'var(--income)'],
                        ['Spent', -month.spent, 'var(--expense)']
                      ] as const
                    ).map(([label, value, color]) => (
                      <p key={label} className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className="h-0.5 w-3 rounded-full"
                          style={{ background: color }}
                        />
                        <span className="amount text-base">{money.format(value)}</span>
                        <span className="text-sm text-ink-muted">{label}</span>
                      </p>
                    ))}
                    <p className="border-t border-line pt-1 text-sm text-ink-muted">
                      Net{' '}
                      <span className="amount text-ink">
                        {money.format(month.net, 'exceptZero')}
                      </span>
                    </p>
                  </div>
                )
              }}
            />
            <Bar
              dataKey="income"
              stackId="month"
              fill="var(--income)"
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
              isAnimationActive={false}
            />
            <Bar
              dataKey="spent"
              stackId="month"
              fill="var(--expense)"
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Income</th>
            <th scope="col">Spent</th>
            <th scope="col">Net</th>
          </tr>
        </thead>
        <tbody>
          {data.map((m) => (
            <tr key={m.start}>
              <th scope="row">{formatDate(m.start, money.locale, { month: 'long' })}</th>
              <td>{money.format(m.income)}</td>
              <td>{money.format(-m.spent)}</td>
              <td>{money.format(m.net, 'exceptZero')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}
