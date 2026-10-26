import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import type { RecurringItem, RecurringItemInput } from '@shared/recurring'
import { invoke } from '@renderer/lib/api'

export const recurringKeys = {
  all: ['recurring'] as const
}

export function useRecurringItems(): UseQueryResult<RecurringItem[]> {
  return useQuery({ queryKey: recurringKeys.all, queryFn: () => invoke('recurring:list') })
}

export function useCreateRecurringItem(): UseMutationResult<
  RecurringItem,
  Error,
  RecurringItemInput
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: RecurringItemInput) => invoke('recurring:create', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: recurringKeys.all })
  })
}
