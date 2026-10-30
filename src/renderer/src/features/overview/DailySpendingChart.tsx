import { useNavigate } from 'react-router'
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { formatDate, type IsoDate, type PeriodKind } from '@shared/dates'
import type { PeriodTotals } from '@shared/stats'
import { Card, CardDescription, CardHeader, CardTitle } from '@renderer/components/ui/card'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { dayPath } from '@renderer/lib/links'
import { cn } from '@renderer/lib/utils'
import { t } from '@renderer/lib/i18n'

interface Day {
  date: IsoDate
  /** Axis label: "Mon" for a week, "14" for a month. */
  tick: string
  expenses: number
}

const axisTick = { fill: 'var(--ink-muted)', fontSize: 12 }

/**
 * Expenses for each day of the period, as columns. One series, so no legend: the title
 * names it. The largest day carries its value; the rest are on hover and in the table.
 * Clicking a day opens it in the Calendar.
 */
export function DailySpendingChart({
  days,
  kind,
  today,
  className
}: {
  days: PeriodTotals[]
  kind: PeriodKind
  today: IsoDate
  className?: string
}): React.JSX.Element {
  const money = useCurrency()
  const navigate = useNavigate()
  const data: Day[] = days.map((d) => ({
    date: d.start,
    tick:
      kind === 'week'
        ? formatDate(d.start, money.locale, { weekday: 'short' })
        : String(Number(d.start.slice(8))),
    expenses: d.expenses
  }))
  const longDate = (date: IsoDate): string =>
    formatDate(date, money.locale, { weekday: 'long', day: 'numeric', month: 'long' })

  const total = data.reduce((sum, d) => sum + d.expenses, 0)
  // A period still going on averages over the days so far.
  const elapsed = data.filter((d) => d.date <= today).length
  const average = elapsed > 0 ? Math.round(total / elapsed) : 0
  const largest = data.reduce<Day | null>(
    (max, d) => (d.expenses > (max?.expenses ?? 0) ? d : max),
    null
  )

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader>
        <div>
          <CardTitle>{t('overview.dailySpending')}</CardTitle>
          <CardDescription>
            {total > 0
              ? t(elapsed < data.length ? 'overview.aDaySoFar' : 'overview.aDay', {
                  amount: money.format(average)
                })
              : t('overview.nothingSpentYet')}
          </CardDescription>
        </div>
      </CardHeader>

      {/* Fills the card when a taller neighbour stretches it; never shorter than minHeight. */}
      <div aria-hidden className="flex-1">
        <ResponsiveContainer width="100%" height="100%" minHeight={240}>
          <BarChart
            data={data}
            margin={{ top: 20, right: 4, bottom: 0, left: 0 }}
            onClick={(state) => {
              const day = data[Number(state.activeTooltipIndex)]
              if (day) void navigate(dayPath(day.date))
            }}
            className="cursor-pointer"
          >
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis
              dataKey="tick"
              tick={axisTick}
              tickLine={false}
              axisLine={{ stroke: 'var(--line)' }}
              interval={kind === 'week' ? 0 : 'preserveStartEnd'}
              minTickGap={8}
            />
            <YAxis
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              width={56}
              allowDecimals={false}
              tickFormatter={(cents: number) => money.compact(cents)}
            />
            <Tooltip
              cursor={{ fill: 'var(--surface-2)' }}
              isAnimationActive={false}
              content={({ active, payload }) => {
                const day = active ? (payload?.[0]?.payload as Day | undefined) : undefined
                if (!day) return null
                return (
                  <div className="rounded-control border border-line bg-surface px-3 py-2 shadow-float">
                    <p className="amount text-base">{money.format(day.expenses)}</p>
                    <p className="text-sm text-ink-muted">{longDate(day.date)}</p>
                  </div>
                )
              }}
            />
            <Bar
              dataKey="expenses"
              fill="var(--expense)"
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
              isAnimationActive={false}
            >
              <LabelList
                dataKey="expenses"
                content={({ x, y, width, index }) =>
                  largest && data[Number(index)]?.date === largest.date ? (
                    <text
                      x={Number(x) + Number(width) / 2}
                      y={Number(y) - 6}
                      textAnchor="middle"
                      fill="var(--ink)"
                      fontSize={12}
                      fontWeight={600}
                    >
                      {money.format(largest.expenses)}
                    </text>
                  ) : null
                }
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <table className="sr-only">
        <caption>{t('overview.spendingPerDay')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('overview.day')}</th>
            <th scope="col">{t('overview.spent')}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <th scope="row">{longDate(d.date)}</th>
              <td>{money.format(d.expenses)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}
