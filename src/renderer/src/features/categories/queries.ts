import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import type { Category, CategoryCreate, CategoryUpdate } from '@shared/categories'
import { invoke } from '@renderer/lib/api'

export const categoryKeys = {
  all: ['categories'] as const
}

/** Every category, archived ones included: income first, then expenses, in the user's order. */
export function useCategories(): UseQueryResult<Category[]> {
  return useQuery({ queryKey: categoryKeys.all, queryFn: () => invoke('categories:list') })
}

function useInvalidateCategories(): () => Promise<void> {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: categoryKeys.all })
}

export function useCreateCategory(): UseMutationResult<Category, Error, CategoryCreate> {
  const invalidate = useInvalidateCategories()
  return useMutation({
    mutationFn: (input: CategoryCreate) => invoke('categories:create', input),
    onSuccess: invalidate
  })
}

export function useUpdateCategory(): UseMutationResult<
  Category,
  Error,
  { id: number; patch: CategoryUpdate }
> {
  const invalidate = useInvalidateCategories()
  return useMutation({
    mutationFn: ({ id, patch }) => invoke('categories:update', id, patch),
    onSuccess: invalidate
  })
}

export function useDeleteCategory(): UseMutationResult<void, Error, number> {
  const invalidate = useInvalidateCategories()
  return useMutation({
    mutationFn: (id: number) => invoke('categories:delete', id),
    onSuccess: invalidate
  })
}

export function useMergeCategory(): UseMutationResult<
  Category,
  Error,
  { sourceId: number; targetId: number }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ sourceId, targetId }) => invoke('categories:merge', sourceId, targetId),
    // A merge rewrites transactions, recurring items and plans too — refresh everything.
    onSuccess: () => queryClient.invalidateQueries()
  })
}
