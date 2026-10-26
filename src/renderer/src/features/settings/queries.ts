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

export function useUpdateSettings(): UseMutationResult<Settings, Error, SettingsPatch> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch: SettingsPatch) => invoke('settings:update', patch),
    onSuccess: (settings) => queryClient.setQueryData(settingsKeys.all, settings)
  })
}
