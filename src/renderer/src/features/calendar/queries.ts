import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { IsoDate } from '@shared/dates'
import type { CalendarMonth } from '@shared/planned'
import { useSettings } from '@renderer/features/settings/queries'
import { invoke } from '@renderer/lib/api'

/** One month of the Calendar: day totals, planned payments and the summary. */
export function useCalendarMonth(month: IsoDate): UseQueryResult<CalendarMonth> {
  // The grid's weeks start on the day set in Settings (read by main), so the key includes it.
  const weekStart = useSettings().data?.weekStart
  return useQuery({
    // Under 'stats' so account changes, which refresh statistics, refresh the calendar too.
    queryKey: ['stats', 'calendar', month, weekStart],
    queryFn: () => invoke('calendar:month', { month }),
    enabled: weekStart !== undefined,
    placeholderData: keepPreviousData
  })
}
