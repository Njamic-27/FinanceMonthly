import { Link } from 'react-router'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { Category } from '@shared/categories'
import type { DateRange } from '@shared/dates'
import { neutralPaletteColor, type PaletteColor } from '@shared/palette'
import type { CategoryTotal } from '@shared/stats'
import { Card, CardDescription, CardHeader, CardTitle } from '@renderer/components/ui/card'
import { foldCategoryTotals } from '@renderer/features/stats/fold'
import { writeFilters } from '@renderer/features/transactions/filters'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { cn } from '@renderer/lib/utils'

/** A donut reads well up to about six slices; the rest fold into "Other". */
const MAX_SLICES = 6

interface Slice {
  key: string
  name: string
  color: PaletteColor
  total: number
  /** Opens the slice's transactions for the period. */
  to: string
}

/**
 * This period's spending split by category. The legend beside it names every slice with its
 * amount and share, so the colours never have to be told apart on their own.
 */
export function CategoryDonut({
  totals,
  categories,
  range,
  title,
  className
}: {
  totals: CategoryTotal[]
  categories: Category[]
  range: DateRange
  title: string
  className?: string
}): React.JSX.Element {
  const money = useCurrency()
  const byId = new Map(categories.map((c) => [c.id, c]))
  const sum = totals.reduce((s, c) => s + c.total, 0)
  const { rows, other } = foldCategoryTotals(totals, MAX_SLICES)
  const link = (patch: { categoryId?: number }): string =>
    `/transactions?${writeFilters({ search: '', from: range.start, to: range.end, kind: 'expense', ...patch })}`

  const slices: Slice[] = rows.map((row) => {
    const category = byId.get(row.categoryId)
    return {
      key: String(row.categoryId),
      name: category?.name ?? 'Unknown category',
      color: category?.color ?? neutralPaletteColor,
      total: row.total,
      to: link({ categoryId: row.categoryId })
    }
  })
  if (other) {
    slices.push({
      key: 'other',
      name: `${other.categories} more`,
      color: neutralPaletteColor,
      total: other.total,
      to: link({})
    })
  }
  const percent = (value: number): string =>
    new Intl.NumberFormat(money.locale, { style: 'percent', maximumFractionDigits: 0 }).format(
      value / sum
    )

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            {sum > 0 ? `${money.format(sum)} in total` : 'Nothing spent yet'}
          </CardDescription>
        </div>
      </CardHeader>

      {sum > 0 && (
        <div className="flex flex-1 flex-col items-center gap-5">
          <div aria-hidden className="relative size-44 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="total"
                  nameKey="name"
                  innerRadius="68%"
                  outerRadius="100%"
                  startAngle={90}
                  endAngle={-270}
                  // The surface-coloured stroke is the 2px gap between slices.
                  stroke="var(--surface)"
                  strokeWidth={2}
                  isAnimationActive={false}
                >
                  {slices.map((s) => (
                    <Cell key={s.key} fill={`var(--swatch-${s.color})`} />
                  ))}
                </Pie>
                <Tooltip
                  isAnimationActive={false}
                  content={({ active, payload }) => {
                    const slice = active ? (payload?.[0]?.payload as Slice | undefined) : undefined
                    if (!slice) return null
                    return (
                      <div className="rounded-control border border-line bg-surface px-3 py-2 shadow-float">
                        <p className="amount text-base">{money.format(slice.total)}</p>
                        <p className="text-sm text-ink-muted">
                          {slice.name} · {percent(slice.total)}
                        </p>
                      </div>
                    )
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <p className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-sm text-ink-muted">Spent</span>
              <span className="amount text-lg">{money.compact(sum)}</span>
            </p>
          </div>

          <ul className="flex w-full flex-col gap-0.5">
            {slices.map((s) => (
              <li key={s.key}>
                <Link
                  to={s.to}
                  className="flex items-center gap-2.5 rounded-control px-2 py-1.5 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <span
                    aria-hidden
                    className="size-3 shrink-0 rounded-[3px]"
                    style={{ background: `var(--swatch-${s.color})` }}
                  />
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  <span className="text-sm text-ink-muted">{percent(s.total)}</span>
                  <span className="amount w-24 shrink-0 text-right">{money.format(s.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}
