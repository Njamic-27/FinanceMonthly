import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import type { Account, AccountInput } from '@shared/accounts'
import { statsKeys } from '@renderer/features/stats/queries'
import { invoke } from '@renderer/lib/api'

export const accountKeys = {
  all: ['accounts'] as const
}

/** Every account, archived ones included, with balances as of today. */
export function useAccounts(): UseQueryResult<Account[]> {
  return useQuery({ queryKey: accountKeys.all, queryFn: () => invoke('accounts:list') })
}

function useInvalidateAccounts(): () => Promise<void> {
  const queryClient = useQueryClient()
  // Opening balances and archiving change the balance in stats series too.
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: accountKeys.all }),
      queryClient.invalidateQueries({ queryKey: statsKeys.all })
    ])
  }
}

export function useCreateAccount(): UseMutationResult<Account, Error, AccountInput> {
  const invalidate = useInvalidateAccounts()
  return useMutation({
    mutationFn: (input: AccountInput) => invoke('accounts:create', input),
    onSuccess: invalidate
  })
}

export function useUpdateAccount(): UseMutationResult<
  Account,
  Error,
  { id: number; input: AccountInput }
> {
  const invalidate = useInvalidateAccounts()
  return useMutation({
    mutationFn: ({ id, input }) => invoke('accounts:update', id, input),
    onSuccess: invalidate
  })
}

export function useArchiveAccount(): UseMutationResult<
  Account,
  Error,
  { id: number; archived: boolean }
> {
  const invalidate = useInvalidateAccounts()
  return useMutation({
    mutationFn: ({ id, archived }) => invoke('accounts:archive', id, archived),
    onSuccess: invalidate
  })
}

export function useDeleteAccount(): UseMutationResult<void, Error, number> {
  const invalidate = useInvalidateAccounts()
  return useMutation({
    mutationFn: (id: number) => invoke('accounts:delete', id),
    onSuccess: invalidate
  })
}
