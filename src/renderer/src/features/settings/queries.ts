import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import type { Settings, SettingsPatch } from '@shared/settings'
import { invoke } from '@renderer/lib/api'

export const settingsKeys = {
  all: ['settings'] as const
}

export function useSettings(): UseQueryResult<Settings> {
  return useQuery({ queryKey: settingsKeys.all, queryFn: () => invoke('settings:get') })
}

/**
 * Applies the patch to the cached settings straight away, so controls bound to a setting
 * respond instantly; rolls back if main rejects it.
 */
export function useUpdateSettings(): UseMutationResult<
  Settings,
  Error,
  SettingsPatch,
  { previous?: Settings }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch: SettingsPatch) => invoke('settings:update', patch),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: settingsKeys.all })
      const previous = queryClient.getQueryData<Settings>(settingsKeys.all)
      if (previous) queryClient.setQueryData(settingsKeys.all, { ...previous, ...patch })
      return { previous }
    },
    onError: (_error, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(settingsKeys.all, context.previous)
    },
    onSuccess: (settings, patch) => {
      queryClient.setQueryData(settingsKeys.all, settings)
      // Which month card spending counts in changes every total: refetch them all.
      if (patch.cardSpendingMonth !== undefined) void queryClient.invalidateQueries()
    }
  })
}
