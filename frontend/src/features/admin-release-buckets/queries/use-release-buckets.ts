import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createReleaseBucket, listReleaseBuckets, updateReleaseBucket } from '../api/release-buckets-api'
import type { ReleaseBucketFormValues } from '../schemas/release-bucket'

/** Every key for this domain, built in one place (docs/FRONTEND_ARCHITECTURE.md §5). */
export const releaseBucketKeys = {
  all: ['release-buckets'] as const,
  list: () => [...releaseBucketKeys.all, 'list'] as const,
}

export function useReleaseBuckets() {
  return useQuery({
    queryKey: releaseBucketKeys.list(),
    queryFn: ({ signal }) => listReleaseBuckets(signal),
  })
}

export function useCreateReleaseBucket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: ReleaseBucketFormValues) => createReleaseBucket(values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: releaseBucketKeys.all }),
  })
}

export function useUpdateReleaseBucket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: number; values: ReleaseBucketFormValues }) =>
      updateReleaseBucket(id, values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: releaseBucketKeys.all }),
  })
}
