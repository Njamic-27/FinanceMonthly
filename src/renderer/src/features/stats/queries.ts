import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query'
import type {
  CategoryTotal,
  CategoryTotalsQuery,
  LargestQuery,
  PeriodTotals,
  StatsRange,
  StatsSeriesQuery,
  Totals
} from '@shared/stats'
import type { IsoDate } from '@shared/dates'
import type { Transaction } from '@shared/transactions'
import { useSettings } from '@renderer/features/settings/queries'
import { invoke } from '@renderer/lib/api'

// Transaction changes and category merges refetch every query, these included; account
// changes invalidate `statsKeys.all` themselves.
export const statsKeys = {
  all: ['stats'] as const,
  totals: (range: StatsRange) => ['stats', 'totals', range] as const,
  series: (query: StatsSeriesQuery, weekStart: number | undefined) =>
    ['stats', 'series', query, weekStart] as const,
  categories: (query: CategoryTotalsQuery) => ['stats', 'categories', query] as const,
  largest: (query: LargestQuery) => ['stats', 'largest', query] as const,
  firstDate: ['stats', 'firstDate'] as const
}

/** Income, expenses, savings and loan movements from `from` to `to`. */
export function useTotals(range: StatsRange): UseQueryResult<Totals> {
  return useQuery({
    queryKey: statsKeys.totals(range),
    queryFn: () => invoke('stats:totals', range),
    // Moving to the next period keeps the old numbers up until the new ones arrive.
    placeholderData: keepPreviousData
  })
}

/** Totals per day, week or month, with the total balance at the end of each. */
export function useSeries(query: StatsSeriesQuery): UseQueryResult<PeriodTotals[]> {
  // Weeks start on the day set in Settings (read by main), so the key includes it and
  // changing it refetches weekly series.
  const weekStart = useSettings().data?.weekStart
  return useQuery({
    queryKey: statsKeys.series(query, query.by === 'week' ? weekStart : undefined),
    queryFn: () => invoke('stats:series', query),
    enabled: query.by !== 'week' || weekStart !== undefined,
    placeholderData: keepPreviousData
  })
}

/** Income or expense totals per category, largest first. */
export function useCategoryTotals(query: CategoryTotalsQuery): UseQueryResult<CategoryTotal[]> {
  return useQuery({
    queryKey: statsKeys.categories(query),
    queryFn: () => invoke('stats:categories', query),
    placeholderData: keepPreviousData
  })
}

/** The largest income or expense transactions, largest first. */
export function useLargest(query: LargestQuery): UseQueryResult<Transaction[]> {
  return useQuery({
    queryKey: statsKeys.largest(query),
    queryFn: () => invoke('stats:largest', query),
    placeholderData: keepPreviousData
  })
}

/** The earliest transaction or account opening date; null with no data yet. */
export function useFirstDate(): UseQueryResult<IsoDate | null> {
  return useQuery({ queryKey: statsKeys.firstDate, queryFn: () => invoke('stats:firstDate') })
}
