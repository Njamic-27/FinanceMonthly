import { Link, useSearchParams } from 'react-router'
import { ChevronLeft, ChevronRight, Plus, Receipt } from 'lucide-react'
import { formatPeriod, today, type IsoDate, type PeriodKind } from '@shared/dates'
import { defaultSettings } from '@shared/settings'
import type { DayTotal } from '@shared/transactions'
import { PageHeader } from '@renderer/components/PageHeader'
import { Button } from '@renderer/components/ui/button'
import { Card, CardDescription, CardTitle } from '@renderer/components/ui/card'
import { SegmentedControl } from '@renderer/components/ui/segmented-control'
import { useAccounts } from '@renderer/features/accounts/queries'
import { useCategories } from '@renderer/features/categories/queries'
import { CategoryBreakdown } from '@renderer/features/overview/CategoryBreakdown'
import { DailySpendingChart } from '@renderer/features/overview/DailySpendingChart'
import { LargestExpenses } from '@renderer/features/overview/LargestExpenses'
import {
  comparisonFor,
  comparisonLabel,
  overviewParams,
  readOverviewPeriod,
  stepPeriod,
  switchKind,
  type OverviewPeriod
} from '@renderer/features/overview/period'
import { SummaryCards } from '@renderer/features/overview/SummaryCards'
import { useSettings } from '@renderer/features/settings/queries'
import {
  useCategoryTotals,
  useFirstDate,
  useLargest,
  useSeries,
  useTotals
} from '@renderer/features/stats/queries'
import { openTransactionDialog } from '@renderer/features/transactions/dialogStore'
import { writeFilters } from '@renderer/features/transactions/filters'
import { useTransactionList } from '@renderer/features/transactions/queries'
import { TransactionList } from '@renderer/features/transactions/TransactionList'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { cn } from '@renderer/lib/utils'

const kindOptions: { value: PeriodKind; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' }
]

const unit = (kind: PeriodKind): string => (kind === 'week' ? 'week' : 'month')

/** Transactions in the period, newest first, a page at a time. */
function PeriodTransactions({
  period,
  label
}: {
  period: OverviewPeriod
  label: string
}): React.JSX.Element {
  const accounts = useAccounts().data ?? []
  const categories = useCategories().data ?? []
  const list = useTransactionList({ from: period.range.start, to: period.range.end })
  const pages = list.data?.pages ?? []
  const transactions = pages.flatMap((p) => p.items)
  const dayTotals = new Map<IsoDate, DayTotal>(
    pages.flatMap((p) => p.dayTotals).map((d) => [d.date, d])
  )
  const count = pages[0]?.summary?.count ?? 0

  return (
    <section aria-labelledby="period-transactions" className="min-w-0">
      <header className="mb-4 flex items-baseline justify-between gap-4 px-1">
        <h2 id="period-transactions" className="text-lg font-semibold">
          {count} transaction{count === 1 ? '' : 's'}
        </h2>
        <Link
          to={`/transactions?${writeFilters({ search: '', from: period.range.start, to: period.range.end })}`}
          className="link text-sm font-semibold text-primary"
        >
          Open {label} in Transactions
        </Link>
      </header>
      <TransactionList
        transactions={transactions}
        dayTotals={dayTotals}
        accounts={accounts}
        categories={categories}
      />
      {list.hasNextPage && (
        <div className="mt-6 flex justify-center">
          <Button
            variant="outline"
            disabled={list.isFetchingNextPage}
            onClick={() => list.fetchNextPage()}
          >
            {list.isFetchingNextPage
              ? 'Loading…'
              : `Show more (${count - transactions.length} left)`}
          </Button>
        </div>
      )}
    </section>
  )
}

/** One week or one month: totals against the previous period, charts and its transactions. */
export function OverviewPage(): React.JSX.Element {
  const money = useCurrency()
  const weekStart = useSettings().data?.weekStart ?? defaultSettings.weekStart
  const [params, setParams] = useSearchParams()
  const now = today()
  const period = readOverviewPeriod(params, now, weekStart)
  const { start: from, end: to } = period.range
  const comparison = comparisonFor(period, now, weekStart)
  // A period from before your data starts would only show things like "100% more".
  const firstDate = useFirstDate().data
  const comparable = !!firstDate && firstDate <= comparison.range.start
  const label = formatPeriod(period.kind, period.range, money.locale)

  const go = (next: OverviewPeriod): void =>
    setParams(overviewParams(next.kind, next.range.start), { replace: true })

  const totals = useTotals({ from, to })
  const previous = useTotals({ from: comparison.range.start, to: comparison.range.end })
  const days = useSeries({ from, to, by: 'day' })
  const byCategory = useCategoryTotals({ from, to, type: 'expense' })
  const largest = useLargest({ from, to, type: 'expense', limit: 5 })
  const categories = useCategories().data ?? []

  // While the next period loads, the previous one stays on screen, dimmed.
  const stale =
    totals.isPlaceholderData ||
    days.isPlaceholderData ||
    byCategory.isPlaceholderData ||
    largest.isPlaceholderData
  const empty = totals.data?.count === 0

  return (
    <>
      <PageHeader
        title="Overview"
        description="One week or one month in detail."
        actions={
          <SegmentedControl
            name="overview-kind"
            aria-label="Show a week or a month"
            value={period.kind}
            options={kindOptions}
            onValueChange={(kind) => go(switchKind(period, kind, now, weekStart))}
          />
        }
      />

      <nav aria-label="Period" className="mb-6 flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label={`Previous ${unit(period.kind)}`}
          title={`Previous ${unit(period.kind)}`}
          onClick={() => go(stepPeriod(period, -1, now, weekStart))}
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label={`Next ${unit(period.kind)}`}
          title={`Next ${unit(period.kind)}`}
          disabled={period.isCurrent}
          onClick={() => go(stepPeriod(period, 1, now, weekStart))}
        >
          <ChevronRight />
        </Button>
        <h2 className="ml-2 text-title font-bold" aria-live="polite">
          {label}
        </h2>
        {!period.isCurrent && (
          <Button
            variant="ghost"
            className="ml-2"
            onClick={() => go(readOverviewPeriod(overviewParams(period.kind, now), now, weekStart))}
          >
            This {unit(period.kind)}
          </Button>
        )}
      </nav>

      {totals.isError && (
        <Card className="max-w-3xl">
          <CardTitle>The overview could not be loaded</CardTitle>
          <CardDescription className="mt-1">{totals.error.message}</CardDescription>
        </Card>
      )}

      {totals.data && (
        <div className={cn('transition-opacity', stale && 'opacity-60')}>
          <SummaryCards
            totals={totals.data}
            previous={comparable ? previous.data : undefined}
            against={comparisonLabel(period, comparison, money.locale)}
          />

          {empty ? (
            <section className="mt-6 flex max-w-2xl flex-col items-start gap-4 rounded-panel border border-dashed border-line p-8">
              <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
                <Receipt className="size-6" />
              </span>
              <div>
                <h2 className="text-lg font-semibold">Nothing recorded in {label}</h2>
                <p className="mt-1 text-ink-muted">
                  {period.isCurrent
                    ? 'Add what you spend and earn, and this page fills in as you go.'
                    : `Step to another ${unit(period.kind)}, or add what you spent then.`}
                </p>
              </div>
              <Button
                onClick={() =>
                  openTransactionDialog({
                    kind: 'new',
                    prefill: { date: period.isCurrent ? now : to }
                  })
                }
              >
                <Plus />
                Add transaction
              </Button>
            </section>
          ) : (
            <>
              <div className="mt-6 grid gap-4 lg:grid-cols-3">
                <DailySpendingChart
                  className="lg:col-span-2"
                  days={days.data ?? []}
                  kind={period.kind}
                  today={now}
                />
                <CategoryBreakdown
                  totals={byCategory.data ?? []}
                  categories={categories}
                  range={period.range}
                />
              </div>
              <div className="mt-4 grid items-start gap-4 lg:grid-cols-3">
                <LargestExpenses
                  transactions={largest.data ?? []}
                  categories={categories}
                  range={period.range}
                />
                <div className="lg:col-span-2">
                  <PeriodTransactions period={period} label={label} />
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
