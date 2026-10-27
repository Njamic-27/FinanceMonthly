import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import type {
  BankLoanInput,
  Loan,
  LoanInstallment,
  PayInstallmentInput,
  PersonalLoanInput,
  RepaymentInput,
  SettleLoanInput
} from '@shared/loans'
import type { Transaction } from '@shared/transactions'
import { invoke } from '@renderer/lib/api'

export const loanKeys = {
  all: ['loans'] as const,
  transactions: (id: number) => ['loans', 'transactions', id] as const,
  schedule: (id: number) => ['loans', 'schedule', id] as const
}

/** Every loan, active ones first. */
export function useLoans(): UseQueryResult<Loan[]> {
  return useQuery({ queryKey: loanKeys.all, queryFn: () => invoke('loans:list') })
}

export function useLoanTransactions(id: number): UseQueryResult<Transaction[]> {
  return useQuery({
    queryKey: loanKeys.transactions(id),
    queryFn: () => invoke('loans:transactions', id)
  })
}

/** A bank loan's installments in order, with their payments. */
export function useLoanSchedule(id: number, enabled = true): UseQueryResult<LoanInstallment[]> {
  return useQuery({
    queryKey: loanKeys.schedule(id),
    queryFn: () => invoke('loans:schedule', id),
    enabled
  })
}

/**
 * Loans move money through accounts (the start, repayments), which changes balances and
 * every list and total, so everything is refetched after a change.
 */
function useInvalidateAll(): () => Promise<void> {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries()
}

function useLoanMutation<V, R>(fn: (variables: V) => Promise<R>): UseMutationResult<R, Error, V> {
  const invalidate = useInvalidateAll()
  return useMutation({ mutationFn: fn, onSuccess: invalidate })
}

export const useCreateLoan = (): UseMutationResult<Loan, Error, PersonalLoanInput> =>
  useLoanMutation((input: PersonalLoanInput) => invoke('loans:create', input))

export const useUpdateLoan = (): UseMutationResult<
  Loan,
  Error,
  { id: number; input: PersonalLoanInput }
> => useLoanMutation(({ id, input }) => invoke('loans:update', id, input))

export const useDeleteLoan = (): UseMutationResult<void, Error, number> =>
  useLoanMutation((id: number) => invoke('loans:delete', id))

export const useAddRepayment = (): UseMutationResult<Transaction, Error, RepaymentInput> =>
  useLoanMutation((input: RepaymentInput) => invoke('loans:addRepayment', input))

export const useUpdateRepayment = (): UseMutationResult<
  Transaction,
  Error,
  { id: number; input: RepaymentInput }
> => useLoanMutation(({ id, input }) => invoke('loans:updateRepayment', id, input))

export const useDeleteRepayment = (): UseMutationResult<void, Error, number> =>
  useLoanMutation((id: number) => invoke('loans:deleteRepayment', id))

export const useSettleLoan = (): UseMutationResult<
  Loan,
  Error,
  { id: number; input: SettleLoanInput }
> => useLoanMutation(({ id, input }) => invoke('loans:settle', id, input))

export const useReopenLoan = (): UseMutationResult<Loan, Error, number> =>
  useLoanMutation((id: number) => invoke('loans:reopen', id))

export const useCreateBankLoan = (): UseMutationResult<Loan, Error, BankLoanInput> =>
  useLoanMutation((input: BankLoanInput) => invoke('loans:createBank', input))

export const useUpdateBankLoan = (): UseMutationResult<
  Loan,
  Error,
  { id: number; input: BankLoanInput }
> => useLoanMutation(({ id, input }) => invoke('loans:updateBank', id, input))

export const usePayInstallment = (): UseMutationResult<
  Transaction,
  Error,
  { installmentId: number; input: PayInstallmentInput }
> =>
  useLoanMutation(({ installmentId, input }) =>
    invoke('loans:payInstallment', installmentId, input)
  )

export const useUnpayInstallment = (): UseMutationResult<void, Error, number> =>
  useLoanMutation((installmentId: number) => invoke('loans:unpayInstallment', installmentId))
