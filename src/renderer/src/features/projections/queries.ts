import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { ProjectionQuery, ProjectionResult } from '@shared/projection'
import { useSettings } from '@renderer/features/settings/queries'
import { statsKeys } from '@renderer/features/stats/queries'
import { invoke } from '@renderer/lib/api'

/** The projection for a horizon and granularity, as the assumptions in Settings say. */
export function useProjection(query: ProjectionQuery): UseQueryResult<ProjectionResult> {
  const settings = useSettings().data
  // Main reads these settings; changing one must project again.
  const assumptions = settings && [
    settings.projectionIncludeVariable,
    settings.projectionVariableMonths,
    settings.projectionIncludeSavings,
    settings.weekStart
  ]
  return useQuery({
    // Under 'stats': every change to transactions, accounts or plans projects again.
    queryKey: [...statsKeys.all, 'projection', query, assumptions],
    queryFn: () => invoke('projection:get', query),
    enabled: settings !== undefined,
    placeholderData: keepPreviousData
  })
}
