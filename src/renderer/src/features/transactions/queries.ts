import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import type { Transaction, TransactionInput } from '@shared/transactions'
import { invoke } from '@renderer/lib/api'

export const transactionKeys = {
  all: ['transactions'] as const,
  detail: (id: number) => ['transactions', id] as const
}

export function useTransaction(id: number | null): UseQueryResult<Transaction> {
  return useQuery({
    queryKey: transactionKeys.detail(id ?? 0),
    queryFn: () => invoke('transactions:get', id ?? 0),
    enabled: id !== null
  })
}

/**
 * A transaction changes balances, category counts and every list and total, so after a
 * change everything is refetched rather than tracking which queries it touched.
 */
function useInvalidateAll(): () => Promise<void> {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries()
}

export function useCreateTransaction(): UseMutationResult<Transaction, Error, TransactionInput> {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: (input: TransactionInput) => invoke('transactions:create', input),
    onSuccess: invalidate
  })
}

export function useUpdateTransaction(): UseMutationResult<
  Transaction,
  Error,
  { id: number; input: TransactionInput }
> {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: ({ id, input }) => invoke('transactions:update', id, input),
    onSuccess: invalidate
  })
}

export function useDeleteTransaction(): UseMutationResult<void, Error, number> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => invoke('transactions:delete', id),
    onSuccess: (_data, id) => {
      // Drop the deleted one first so nothing refetches it and gets "not found".
      queryClient.removeQueries({ queryKey: transactionKeys.detail(id) })
      return queryClient.invalidateQueries()
    }
  })
}
