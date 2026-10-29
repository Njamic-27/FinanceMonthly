import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import type {
  MoneyOutItems,
  MoneyOutQuery,
  MonthCellInput,
  MonthKey,
  MonthLineInput,
  MonthRowAccountInput,
  MonthRowHide,
  MonthRowKind,
  MonthRowOrder,
  MonthRowRename,
  MonthRowQuery,
  MonthSheet
} from '@shared/month'
import type { Transaction } from '@shared/transactions'
import { invoke } from '@renderer/lib/api'

// Under 'stats' so account changes, which refresh statistics, refresh the sheet too.
export const monthKeys = {
  sheet: (month: MonthKey) => ['stats', 'month', month] as const,
  row: (query: MonthRowQuery | null) => ['stats', 'month-row', query] as const,
  items: (query: MoneyOutQuery | null) => ['stats', 'month-items', query] as const
}

/** One month of the Month sheet: sections, rows, totals and the summary. */
export function useMonthSheet(month: MonthKey): UseQueryResult<MonthSheet> {
  return useQuery({
    queryKey: monthKeys.sheet(month),
    queryFn: () => invoke('month:sheet', { month }),
    placeholderData: keepPreviousData
  })
}

/** What one money-out line is made of; nothing while `query` is null. */
export function useMoneyOutItems(query: MoneyOutQuery | null): UseQueryResult<MoneyOutItems> {
  return useQuery({
    queryKey: monthKeys.items(query),
    queryFn: () => invoke('month:moneyOutItems', query as MoneyOutQuery),
    enabled: query !== null
  })
}

/** The transactions behind one row, newest first; nothing while `query` is null. */
export function useMonthRowTransactions(
  query: MonthRowQuery | null
): UseQueryResult<Transaction[]> {
  return useQuery({
    queryKey: monthKeys.row(query),
    queryFn: () => invoke('month:rowTransactions', query as MonthRowQuery),
    enabled: query !== null
  })
}

/**
 * Every cell writes transactions, which changes balances and every list and total, so
 * everything is refetched (as after a transaction changes).
 */
function useInvalidateAll(): () => Promise<void> {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries()
}

/**
 * Typing an amount into a row. The next cell is often typed before the last one is saved, so
 * `onSettled` is given here: callbacks passed to `mutate` run only for the latest call.
 */
export function useSetMonthCell(
  onSettled: (input: MonthCellInput, error: Error | null) => void
): UseMutationResult<void, Error, MonthCellInput> {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: (input: MonthCellInput) => invoke('month:setCell', input),
    onSettled: async (_data, error, input) => {
      await invalidate()
      onSettled(input, error)
    }
  })
}

export function useSetMonthRowAccount(): UseMutationResult<void, Error, MonthRowAccountInput> {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: (input: MonthRowAccountInput) => invoke('month:setRowAccount', input),
    onSuccess: invalidate
  })
}

export function useCopyFromLastMonth(): UseMutationResult<number, Error, MonthKey> {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: (month: MonthKey) => invoke('month:copyFromLastMonth', { month }),
    onSuccess: invalidate
  })
}

export function useAddMonthLine(): UseMutationResult<
  { kind: MonthRowKind; sourceId: number },
  Error,
  MonthLineInput
> {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: (input: MonthLineInput) => invoke('month:addLine', input),
    onSuccess: invalidate
  })
}

export function useRenameMonthRow(): UseMutationResult<void, Error, MonthRowRename> {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: (input: MonthRowRename) => invoke('month:renameRow', input),
    onSuccess: invalidate
  })
}

export function useHideMonthRow(): UseMutationResult<void, Error, MonthRowHide> {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: (input: MonthRowHide) => invoke('month:hideRow', input),
    onSuccess: invalidate
  })
}

/** Removes a category row's transactions counted in the month; resolves to how many. */
export function useClearMonthRow(): UseMutationResult<number, Error, MonthRowQuery> {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: (input: MonthRowQuery) => invoke('month:clearRow', input),
    onSuccess: invalidate
  })
}

/** Only the sheet shows the order, so only the sheet is refetched. */
export function useReorderMonthRows(): UseMutationResult<void, Error, MonthRowOrder> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: MonthRowOrder) => invoke('month:reorderRows', input),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['stats', 'month'] })
  })
}
