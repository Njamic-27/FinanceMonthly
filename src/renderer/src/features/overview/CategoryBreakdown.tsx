import { Link } from 'react-router'
import { Ellipsis } from 'lucide-react'
import { fallbackCategoryIcon, type Category } from '@shared/categories'
import type { DateRange } from '@shared/dates'
import { neutralPaletteColor, type PaletteColor } from '@shared/palette'
import type { CategoryTotal } from '@shared/stats'
import { ColorChip } from '@renderer/components/ColorChip'
import { Card, CardDescription, CardHeader, CardTitle } from '@renderer/components/ui/card'
import { categoryIconComponents } from '@renderer/features/categories/appearance'
import { foldCategoryTotals } from '@renderer/features/stats/fold'
import { writeFilters } from '@renderer/features/transactions/filters'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { categoryPath } from '@renderer/lib/links'
import { swatchStyle } from '@renderer/lib/palette'
import { cn } from '@renderer/lib/utils'
import { t } from '@renderer/lib/i18n'

/** Rows shown before the rest fold into "Other". */
const MAX_ROWS = 7

function Row({
  name,
  chip,
  color,
  total,
  share,
  to
}: {
  name: string
  chip: React.ReactNode
  color: PaletteColor
  total: string
  share: number
  to?: string
}): React.JSX.Element {
  const money = useCurrency()
  const percent = new Intl.NumberFormat(money.locale, {
    style: 'percent',
    maximumFractionDigits: 0
  }).format(share)
  const content = (
    <span className="flex items-center gap-3">
      {chip}
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate font-semibold">{name}</span>
          <span className="amount shrink-0">{total}</span>
        </span>
        <span className="mt-1.5 flex items-center gap-2">
          {/* The share of the period's spending, in the category's colour. */}
          <span aria-hidden className="h-1.5 flex-1 rounded-full bg-surface-2">
            <span
              style={{ ...swatchStyle(color), width: `${Math.max(share * 100, 1)}%` }}
              className="block h-full rounded-full bg-(color:--swatch)"
            />
          </span>
          <span className="w-9 shrink-0 text-right text-sm text-ink-muted">{percent}</span>
        </span>
      </span>
    </span>
  )
  const rowClass = 'block rounded-control px-2 py-2'
  return (
    <li>
      {to ? (
        <Link
          to={to}
          title={t('overview.showCategory', { name })}
          className={cn(rowClass, 'link-row')}
        >
          {content}
        </Link>
      ) : (
        <div className={rowClass}>{content}</div>
      )}
    </li>
  )
}

/** Spending per category, largest first; each row opens its transactions for the period. */
export function CategoryBreakdown({
  totals,
  categories,
  range,
  className
}: {
  totals: CategoryTotal[]
  categories: Category[]
  range: DateRange
  className?: string
}): React.JSX.Element {
  const money = useCurrency()
  const byId = new Map(categories.map((c) => [c.id, c]))
  const sum = totals.reduce((s, c) => s + c.total, 0)
  const { rows, other } = foldCategoryTotals(totals, MAX_ROWS)

  return (
    <Card className={className}>
      <CardHeader>
        <div>
          <CardTitle>{t('overview.spendingByCategory')}</CardTitle>
          <CardDescription>
            {totals.length === 0
              ? t('overview.nothingSpentYet')
              : `${totals.length} ${totals.length === 1 ? 'category' : 'categories'}`}
          </CardDescription>
        </div>
      </CardHeader>
      <ul className="-mx-2 flex flex-col gap-0.5">
        {rows.map((row) => {
          const category = byId.get(row.categoryId)
          const color = category?.color ?? neutralPaletteColor
          return (
            <Row
              key={row.categoryId}
              name={category?.name ?? t('overview.unknownCategory')}
              color={color}
              chip={
                <ColorChip
                  color={color}
                  icon={categoryIconComponents[category?.icon ?? fallbackCategoryIcon]}
                  size="sm"
                />
              }
              total={money.format(row.total)}
              share={row.total / sum}
              to={categoryPath(row.categoryId, range)}
            />
          )
        })}
        {other && (
          <Row
            name={t('overview.moreCategories', { count: other.categories })}
            color={neutralPaletteColor}
            chip={<ColorChip color={neutralPaletteColor} icon={Ellipsis} size="sm" />}
            total={money.format(other.total)}
            share={other.total / sum}
            to={`/transactions?${writeFilters({
              search: '',
              from: range.start,
              to: range.end,
              kind: 'expense'
            })}`}
          />
        )}
      </ul>
    </Card>
  )
}
