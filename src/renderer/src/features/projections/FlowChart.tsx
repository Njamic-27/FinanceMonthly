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
import type { ProjectionPeriod, ProjectionResult } from '@shared/projection'
import { Card, CardDescription, CardHeader, CardTitle } from '@renderer/components/ui/card'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { cn } from '@renderer/lib/utils'
import { periodLabel, periodTick } from './labels'
import { flowParts } from './parts'

type Part = (typeof flowParts)[number]['key']

interface Row extends Record<Part, number> {
  tick: string
  label: string
  period: ProjectionPeriod
}

const axisTick = { fill: 'var(--ink-muted)', fontSize: 12 }

function Swatch({ color, opacity }: { color: string; opacity: number }): React.JSX.Element {
  return (
    <span
      aria-hidden
      className="size-3 shrink-0 rounded-[3px]"
      style={{ background: color, opacity }}
    />
  )
}

/**
 * Money in above the line and money out below it, stacked by kind, for each week or month.
 * Position separates in from out, so the chart never relies on green against red; the kinds
 * of money out have a legend, gaps between segments and a breakdown on hover.
 */
export function FlowChart({
  projection,
  className
}: {
  projection: ProjectionResult
  className?: string
}): React.JSX.Element {
  const money = useCurrency()
  const data: Row[] = projection.periods.map((p) => ({
    tick: periodTick(p, projection.granularity, money.locale),
    label: periodLabel(p, projection.granularity, money.locale),
    period: p,
    inflow: p.inflow,
    fixed: -p.fixed,
    variable: -p.variable,
    loans: -p.loans,
    savings: -p.savings
  }))
  // Only kinds that occur get a bar and a legend entry.
  const parts = flowParts.filter((part) => projection.periods.some((p) => p[part.key] > 0))

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader className="flex-wrap">
        <div>
          <CardTitle>Money in and out</CardTitle>
          <CardDescription>
            Each {projection.granularity}: what comes in above the line, what goes out below.
          </CardDescription>
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
          {parts.map((part) => (
            <li key={part.key} className="flex items-center gap-1.5">
              <Swatch color={part.color} opacity={part.opacity} />
              {part.label}
            </li>
          ))}
        </ul>
      </CardHeader>
      <div aria-hidden className="flex-1">
        <ResponsiveContainer width="100%" height="100%" minHeight={280}>
          <BarChart
            data={data}
            stackOffset="sign"
            barCategoryGap={projection.granularity === 'week' ? 2 : '20%'}
            margin={{ top: 8, right: 4, bottom: 0, left: 0 }}
          >
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis
              dataKey="tick"
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={16}
            />
            <YAxis
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              width={64}
              allowDecimals={false}
              tickFormatter={(cents: number) => money.compact(Math.abs(cents))}
            />
            <ReferenceLine y={0} stroke="var(--ink-muted)" />
            <Tooltip
              cursor={{ fill: 'var(--surface-2)' }}
              isAnimationActive={false}
              content={({ active, payload }) => {
                const row = active ? (payload?.[0]?.payload as Row | undefined) : undefined
                if (!row) return null
                return (
                  <div className="grid gap-1 rounded-control border border-line bg-surface px-3 py-2 shadow-float">
                    <p className="text-sm text-ink-muted">{row.label}</p>
                    {parts
                      .filter((part) => row.period[part.key] > 0)
                      .map((part) => (
                        <p key={part.key} className="flex items-center gap-2">
                          <Swatch color={part.color} opacity={part.opacity} />
                          <span className="amount text-base">
                            {money.format(row.period[part.key])}
                          </span>
                          <span className="text-sm text-ink-muted">{part.label}</span>
                        </p>
                      ))}
                    <p className="border-t border-line pt-1 text-sm text-ink-muted">
                      Net{' '}
                      <span className="amount text-ink">
                        {money.format(row.period.net, 'exceptZero')}
                      </span>
                    </p>
                  </div>
                )
              }}
            />
            {parts.map((part) => (
              <Bar
                key={part.key}
                dataKey={part.key}
                stackId="flow"
                fill={part.color}
                fillOpacity={part.opacity}
                // A 2px surface gap between stacked segments.
                stroke="var(--surface)"
                strokeWidth={2}
                maxBarSize={28}
                radius={part.key === 'inflow' ? [4, 4, 0, 0] : 0}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
