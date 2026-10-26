import { fallbackCategoryIcon, type Category } from '@shared/categories'
import { formatDate } from '@shared/dates'
import { neutralPaletteColor } from '@shared/palette'
import type { Transaction } from '@shared/transactions'
import { ColorChip } from '@renderer/components/ColorChip'
import { Card, CardDescription, CardHeader, CardTitle } from '@renderer/components/ui/card'
import { categoryIconComponents } from '@renderer/features/categories/appearance'
import { openTransactionDialog } from '@renderer/features/transactions/dialogStore'
import { useCurrency } from '@renderer/hooks/useCurrency'

/** The period's biggest expenses; each opens for editing. */
export function LargestExpenses({
  transactions,
  categories,
  className
}: {
  transactions: Transaction[]
  categories: Category[]
  className?: string
}): React.JSX.Element {
  const money = useCurrency()
  const byId = new Map(categories.map((c) => [c.id, c]))

  return (
    <Card className={className}>
      <CardHeader>
        <div>
          <CardTitle>Largest expenses</CardTitle>
          {transactions.length === 0 && <CardDescription>Nothing spent yet</CardDescription>}
        </div>
      </CardHeader>
      <ol className="-mx-2 flex flex-col gap-0.5">
        {transactions.map((tx) => {
          const category = tx.categoryId ? byId.get(tx.categoryId) : undefined
          return (
            <li key={tx.id}>
              <button
                type="button"
                onClick={() => openTransactionDialog({ kind: 'edit', id: tx.id })}
                className="flex w-full cursor-pointer items-center gap-3 rounded-control px-2 py-2 text-left transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary"
              >
                <ColorChip
                  color={category?.color ?? neutralPaletteColor}
                  icon={categoryIconComponents[category?.icon ?? fallbackCategoryIcon]}
                  size="sm"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{tx.title}</span>
                  <span className="block truncate text-sm text-ink-muted">
                    {formatDate(tx.date, money.locale, {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short'
                    })}
                    {category && ` · ${category.name}`}
                  </span>
                </span>
                <span className="amount shrink-0">{money.format(tx.amount)}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}
