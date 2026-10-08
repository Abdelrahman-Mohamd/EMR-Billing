import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createReleaseBucket,
  deleteReleaseBucket,
  getReleaseBucket,
  listReleaseBuckets,
  setReleaseBucketActive,
  updateReleaseBucket,
} from '../api/release-buckets-api'
import type { ReleaseBucket, ReleaseBucketFormValues } from '../schemas/release-bucket'

/** Every key for this domain, built in one place (docs/FRONTEND_ARCHITECTURE.md §5). */
export const releaseBucketKeys = {
  all: ['release-buckets'] as const,
  list: () => [...releaseBucketKeys.all, 'list'] as const,
  detail: (id: number) => [...releaseBucketKeys.all, 'detail', id] as const,
}

export function useReleaseBuckets() {
  return useQuery({
    queryKey: releaseBucketKeys.list(),
    queryFn: ({ signal }) => listReleaseBuckets(signal),
  })
}

/** One bucket as it is now, for the edit form; `null` asks for nothing (a new one). */
export function useReleaseBucket(id: number | null) {
  return useQuery({
    queryKey: releaseBucketKeys.detail(id ?? 0),
    queryFn: ({ signal }) => getReleaseBucket(id ?? 0, signal),
    enabled: id !== null,
    // The form must start from the record as it is now, not as it was cached.
    staleTime: 0,
  })
}

function useInvalidateReleaseBuckets() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: releaseBucketKeys.all })
}

export function useCreateReleaseBucket() {
  const invalidate = useInvalidateReleaseBuckets()
  return useMutation({
    mutationFn: (values: ReleaseBucketFormValues) => createReleaseBucket(values),
    onSuccess: invalidate,
  })
}

export function useUpdateReleaseBucket() {
  const invalidate = useInvalidateReleaseBuckets()
  return useMutation({
    mutationFn: ({ id, values }: { id: number; values: ReleaseBucketFormValues }) =>
      updateReleaseBucket(id, values),
    onSuccess: invalidate,
  })
}

/**
 * The row's Active switch, once confirmed. When the server has saved it, the
 * new status is written into the cached list at once — the switch shows it as
 * the dialog closes — and the list is read again in the background.
 */
export function useSetReleaseBucketActive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => setReleaseBucketActive(id, isActive),
    onSuccess: (_message, { id, isActive }) => {
      queryClient.setQueryData<ReleaseBucket[]>(releaseBucketKeys.list(), (buckets) =>
        buckets?.map((bucket) => (bucket.id === id ? { ...bucket, isActive } : bucket)),
      )
      void queryClient.invalidateQueries({ queryKey: releaseBucketKeys.all })
    },
  })
}

export function useDeleteReleaseBucket() {
  const invalidate = useInvalidateReleaseBuckets()
  return useMutation({
    mutationFn: (id: number) => deleteReleaseBucket(id),
    onSuccess: invalidate,
  })
}
