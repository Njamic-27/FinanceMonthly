import { useSearchParams } from 'react-router'
import { ChevronLeft, ChevronRight, History, Plus } from 'lucide-react'
import { today, type PeriodKind } from '@shared/dates'
import { IncomeSpendingChart } from '@renderer/components/charts/IncomeSpendingChart'
import { PageHeader } from '@renderer/components/PageHeader'
import { Button } from '@renderer/components/ui/button'
import { Card, CardDescription, CardTitle } from '@renderer/components/ui/card'
import { SegmentedControl } from '@renderer/components/ui/segmented-control'
import { HeatLegend, PeriodGrid } from '@renderer/features/history/PeriodGrid'
import {
  historyParams,
  readHistory,
  yearComparison,
  yearComparisonLabel,
  yearRange,
  type HistoryState
} from '@renderer/features/history/year'
import { SummaryCards } from '@renderer/features/overview/SummaryCards'
import { useFirstDate, useSeries, useTotals } from '@renderer/features/stats/queries'
import { openTransactionDialog } from '@renderer/features/transactions/dialogStore'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { cn } from '@renderer/lib/utils'
import { t } from '@renderer/lib/i18n'

const viewOptions = (): { value: PeriodKind; label: string }[] => [
  { value: 'month', label: t('history.months') },
  { value: 'week', label: t('history.weeks') }
]

/** A year at a time: totals against the year before, a monthly chart and a heat grid. */
export function HistoryPage(): React.JSX.Element {
  const money = useCurrency()
  const [params, setParams] = useSearchParams()
  const now = today()
  const state = readHistory(params, now)
  const { year, view } = state
  const { start: from, end: to } = yearRange(year)
  const currentYear = Number(now.slice(0, 4))
  const firstDate = useFirstDate().data
  const firstYear = firstDate ? Number(firstDate.slice(0, 4)) : currentYear
  const comparison = yearComparison(year, now)
  // A year from before your data starts would only show things like "900% more".
  const comparable = !!firstDate && firstDate <= comparison.range.start

  const go = (patch: Partial<HistoryState>): void =>
    setParams(historyParams({ ...state, ...patch }), { replace: true })

  const totals = useTotals({ from, to })
  const previous = useTotals({ from: comparison.range.start, to: comparison.range.end })
  const months = useSeries({ from, to, by: 'month' })
  const weeks = useSeries({ from, to, by: 'week' })
  const tiles = view === 'month' ? months : weeks

  const stale = totals.isPlaceholderData || months.isPlaceholderData || tiles.isPlaceholderData
  const empty = totals.data?.count === 0

  return (
    <>
      <PageHeader
        title={t('screen.history')}
        description={t('history.pastMonthsAndWeeks')}
        actions={
          <SegmentedControl
            name="history-view"
            aria-label={t('history.showMonthsOrWeeks')}
            value={view}
            options={viewOptions()}
            onValueChange={(next) => go({ view: next })}
          />
        }
      />

      <nav aria-label={t('history.year')} className="mb-6 flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label={t('calendar.previousYear')}
          title={t('calendar.previousYear')}
          disabled={year <= firstYear}
          onClick={() => go({ year: year - 1 })}
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label={t('calendar.nextYear')}
          title={t('calendar.nextYear')}
          disabled={year >= currentYear}
          onClick={() => go({ year: year + 1 })}
        >
          <ChevronRight />
        </Button>
        <h2 className="ml-2 text-title font-bold" aria-live="polite">
          {year}
        </h2>
        {year !== currentYear && (
          <Button variant="ghost" className="ml-2" onClick={() => go({ year: currentYear })}>
            {t('history.thisYear')}
          </Button>
        )}
      </nav>

      {totals.isError && (
        <Card className="max-w-3xl">
          <CardTitle>{t('history.historyCouldNotBe')}</CardTitle>
          <CardDescription className="mt-1">{totals.error.message}</CardDescription>
        </Card>
      )}

      {totals.data && (
        <div className={cn('transition-opacity', stale && 'opacity-60')}>
          <SummaryCards
            totals={totals.data}
            previous={comparable ? previous.data : undefined}
            against={yearComparisonLabel(comparison, money.locale)}
          />

          {empty ? (
            <section className="mt-6 flex max-w-2xl flex-col items-start gap-4 rounded-panel border border-dashed border-line p-8">
              <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
                <History className="size-6" />
              </span>
              <div>
                <h2 className="text-lg font-semibold">
                  {t('history.nothingRecordedIn', { year })}
                </h2>
                <p className="mt-1 text-ink-muted">
                  {year === currentYear
                    ? t('history.asYouAddWhat')
                    : t('history.chooseAnotherYearOr')}
                </p>
              </div>
              <Button
                onClick={() =>
                  openTransactionDialog({
                    kind: 'new',
                    prefill: { date: year === currentYear ? now : to }
                  })
                }
              >
                <Plus />
                {t('shell.addTransaction')}
              </Button>
            </section>
          ) : (
            <>
              <div className="mt-6">
                <IncomeSpendingChart
                  title={t('history.incomeAndSpendingBy')}
                  months={months.data ?? []}
                />
              </div>
              <section aria-labelledby="history-grid" className="mt-8">
                <header className="mb-4 flex flex-wrap items-end justify-between gap-3 px-1">
                  <div>
                    <h2 id="history-grid" className="text-lg font-semibold">
                      {view === 'month' ? t('history.monthByMonth') : t('history.weekByWeek')}
                    </h2>
                    <p className="text-sm text-ink-muted">
                      {t(view === 'month' ? 'history.shadedMonth' : 'history.shadedWeek', { year })}
                    </p>
                  </div>
                  <HeatLegend />
                </header>
                <PeriodGrid periods={tiles.data ?? []} view={view} today={now} />
              </section>
            </>
          )}
        </div>
      )}
    </>
  )
}
