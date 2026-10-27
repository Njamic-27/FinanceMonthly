import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import type { InstallmentPlan, InstallmentPlanInput } from '@shared/installments'
import { invoke } from '@renderer/lib/api'

export const installmentKeys = {
  all: ['installments'] as const,
  forAccount: (accountId: number) => ['installments', accountId] as const
}

/** The installment plans on a card, the newest first. */
export function useInstallmentPlans(accountId: number): UseQueryResult<InstallmentPlan[]> {
  return useQuery({
    queryKey: installmentKeys.forAccount(accountId),
    queryFn: () => invoke('installments:list', accountId)
  })
}

/**
 * Creating or deleting a plan charges or removes installments, which changes balances, the
 * card's limit and every list and total: everything is refetched.
 */
function useInvalidateAll(): () => Promise<void> {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries()
}

export function useCreateInstallmentPlan(): UseMutationResult<
  InstallmentPlan,
  Error,
  InstallmentPlanInput
> {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: (input: InstallmentPlanInput) => invoke('installments:create', input),
    onSuccess: invalidate
  })
}

export function useDeleteInstallmentPlan(): UseMutationResult<void, Error, number> {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: (id: number) => invoke('installments:delete', id),
    onSuccess: invalidate
  })
}
