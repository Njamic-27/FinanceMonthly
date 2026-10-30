import { Link } from 'react-router'
import { fallbackCategoryIcon, type Category } from '@shared/categories'
import { formatDate, type DateRange } from '@shared/dates'
import { neutralPaletteColor } from '@shared/palette'
import type { Transaction } from '@shared/transactions'
import { ColorChip } from '@renderer/components/ColorChip'
import { Card, CardDescription, CardHeader, CardTitle } from '@renderer/components/ui/card'
import { categoryIconComponents } from '@renderer/features/categories/appearance'
import { openTransactionDialog } from '@renderer/features/transactions/dialogStore'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { categoryPath, dayPath } from '@renderer/lib/links'
import { t } from '@renderer/lib/i18n'

/** The period's biggest expenses; each opens for editing. */
export function LargestExpenses({
  transactions,
  categories,
  range,
  className
}: {
  transactions: Transaction[]
  categories: Category[]
  /** The period shown: a category opens its transactions in it. */
  range: DateRange
  className?: string
}): React.JSX.Element {
  const money = useCurrency()
  const byId = new Map(categories.map((c) => [c.id, c]))

  return (
    <Card className={className}>
      <CardHeader>
        <div>
          <CardTitle>{t('overview.largestExpenses')}</CardTitle>
          {transactions.length === 0 && (
            <CardDescription>{t('overview.nothingSpentYet')}</CardDescription>
          )}
        </div>
      </CardHeader>
      <ol className="-mx-2 flex flex-col gap-0.5">
        {transactions.map((tx) => {
          const category = tx.categoryId ? byId.get(tx.categoryId) : undefined
          return (
            <li key={tx.id} className="link-row relative flex items-center gap-3 px-2 py-2">
              <ColorChip
                color={category?.color ?? neutralPaletteColor}
                icon={categoryIconComponents[category?.icon ?? fallbackCategoryIcon]}
                size="sm"
              />
              <span className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => openTransactionDialog({ kind: 'edit', id: tx.id })}
                  className="link-cover block w-full truncate text-left font-semibold"
                >
                  {tx.title}
                </button>
                <span className="block truncate text-sm text-ink-muted">
                  <Link to={dayPath(tx.date)} className="link">
                    {formatDate(tx.date, money.locale, {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short'
                    })}
                  </Link>
                  {category && (
                    <>
                      {' · '}
                      <Link to={categoryPath(category.id, range)} className="link">
                        {category.name}
                      </Link>
                    </>
                  )}
                </span>
              </span>
              <span className="amount shrink-0">{money.format(tx.amount)}</span>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}
