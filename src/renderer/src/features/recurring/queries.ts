import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import type { IsoDate } from '@shared/dates'
import type {
  DueOccurrence,
  PostOccurrenceInput,
  RecurringItem,
  RecurringItemInput
} from '@shared/recurring'
import type { UpcomingPayment } from '@shared/planned'
import type { Transaction } from '@shared/transactions'
import { invoke } from '@renderer/lib/api'

export const recurringKeys = {
  all: ['recurring'] as const,
  due: ['recurring', 'due'] as const,
  upcoming: ['recurring', 'upcoming'] as const
}

export function useRecurringItems(): UseQueryResult<RecurringItem[]> {
  return useQuery({ queryKey: recurringKeys.all, queryFn: () => invoke('recurring:list') })
}

/** Occurrences due by today that wait to be confirmed or skipped, oldest first. */
export function useDueOccurrences(): UseQueryResult<DueOccurrence[]> {
  return useQuery({ queryKey: recurringKeys.due, queryFn: () => invoke('recurring:due') })
}

/** Planned payments in the next 14 days, with their reminders. */
export function useUpcomingPayments(): UseQueryResult<UpcomingPayment[]> {
  return useQuery({
    queryKey: recurringKeys.upcoming,
    queryFn: () => invoke('reminders:upcoming')
  })
}

/**
 * Saving, posting or skipping can add transactions, which changes balances and every list
 * and total, so everything is refetched (as after a transaction changes).
 */
function useInvalidateAll(): () => Promise<void> {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries()
}

export function useCreateRecurringItem(): UseMutationResult<
  RecurringItem,
  Error,
  RecurringItemInput
> {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: (input: RecurringItemInput) => invoke('recurring:create', input),
    onSuccess: invalidate
  })
}

export function useUpdateRecurringItem(): UseMutationResult<
  RecurringItem,
  Error,
  { id: number; input: RecurringItemInput }
> {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: ({ id, input }) => invoke('recurring:update', id, input),
    onSuccess: invalidate
  })
}

export function useDeleteRecurringItem(): UseMutationResult<void, Error, number> {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: (id: number) => invoke('recurring:delete', id),
    onSuccess: invalidate
  })
}

export function usePostOccurrence(): UseMutationResult<Transaction, Error, PostOccurrenceInput> {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: (input: PostOccurrenceInput) => invoke('recurring:post', input),
    onSuccess: invalidate
  })
}

export function useSkipOccurrence(): UseMutationResult<
  RecurringItem,
  Error,
  { itemId: number; plannedDate: IsoDate }
> {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: ({ itemId, plannedDate }) => invoke('recurring:skip', itemId, plannedDate),
    onSuccess: invalidate
  })
}

export function useSetRecurringActive(): UseMutationResult<
  RecurringItem,
  Error,
  { id: number; active: boolean }
> {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: ({ id, active }) => invoke('recurring:setActive', id, active),
    onSuccess: invalidate
  })
}

export function useCancelRecurringItem(): UseMutationResult<RecurringItem, Error, number> {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: (id: number) => invoke('recurring:cancel', id),
    onSuccess: invalidate
  })
}
