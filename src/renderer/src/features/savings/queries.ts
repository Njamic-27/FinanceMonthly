import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import type { BalancePoint } from '@shared/cards'
import type { SavingsGoal, SavingsGoalInput, SavingsMovementInput } from '@shared/savings'
import type { Transaction } from '@shared/transactions'
import { invoke } from '@renderer/lib/api'

export const savingsKeys = {
  all: ['savings'] as const,
  movements: (goalId: number) => ['savings', 'movements', goalId] as const,
  series: (goalId: number) => ['savings', 'series', goalId] as const
}

/** Every goal, archived ones included, with what each holds. */
export function useSavingsGoals(): UseQueryResult<SavingsGoal[]> {
  return useQuery({ queryKey: savingsKeys.all, queryFn: () => invoke('savings:list') })
}

export function useSavingsMovements(goalId: number): UseQueryResult<Transaction[]> {
  return useQuery({
    queryKey: savingsKeys.movements(goalId),
    queryFn: () => invoke('savings:movements', goalId)
  })
}

export function useSavingsSeries(goalId: number): UseQueryResult<BalancePoint[]> {
  return useQuery({
    queryKey: savingsKeys.series(goalId),
    queryFn: () => invoke('savings:series', goalId)
  })
}

/** Goal details only change goals; a goal's name or colour shows nowhere else. */
function useInvalidateGoals(): () => Promise<void> {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: savingsKeys.all })
}

/**
 * Deposits and withdrawals are transactions: they change account balances and every list
 * and total, so everything is refetched.
 */
function useInvalidateAll(): () => Promise<void> {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries()
}

export function useCreateSavingsGoal(): UseMutationResult<SavingsGoal, Error, SavingsGoalInput> {
  const invalidate = useInvalidateGoals()
  return useMutation({
    mutationFn: (input: SavingsGoalInput) => invoke('savings:create', input),
    onSuccess: invalidate
  })
}

export function useUpdateSavingsGoal(): UseMutationResult<
  SavingsGoal,
  Error,
  { id: number; input: SavingsGoalInput }
> {
  // The starting amount changes what the goal held on every day.
  const invalidate = useInvalidateGoals()
  return useMutation({
    mutationFn: ({ id, input }) => invoke('savings:update', id, input),
    onSuccess: invalidate
  })
}

export function useArchiveSavingsGoal(): UseMutationResult<
  SavingsGoal,
  Error,
  { id: number; archived: boolean }
> {
  const invalidate = useInvalidateGoals()
  return useMutation({
    mutationFn: ({ id, archived }) => invoke('savings:archive', id, archived),
    onSuccess: invalidate
  })
}

export function useDeleteSavingsGoal(): UseMutationResult<void, Error, number> {
  const invalidate = useInvalidateGoals()
  return useMutation({
    mutationFn: (id: number) => invoke('savings:delete', id),
    onSuccess: invalidate
  })
}

export function useAddSavingsMovement(): UseMutationResult<
  Transaction,
  Error,
  SavingsMovementInput
> {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: (input: SavingsMovementInput) => invoke('savings:addMovement', input),
    onSuccess: invalidate
  })
}

export function useUpdateSavingsMovement(): UseMutationResult<
  Transaction,
  Error,
  { id: number; input: SavingsMovementInput }
> {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: ({ id, input }) => invoke('savings:updateMovement', id, input),
    onSuccess: invalidate
  })
}

export function useDeleteSavingsMovement(): UseMutationResult<void, Error, number> {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: (id: number) => invoke('savings:deleteMovement', id),
    onSuccess: invalidate
  })
}
