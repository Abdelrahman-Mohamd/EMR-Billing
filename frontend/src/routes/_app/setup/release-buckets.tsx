import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { ReleaseBucketsScreen } from '@/features/admin-release-buckets'

/** `?practice=<id>`: the practice the list is filtered to. An opaque id, no PHI. */
const searchSchema = z.object({
  practice: z.coerce.number().int().positive().optional().catch(undefined),
})

export const Route = createFileRoute('/_app/setup/release-buckets')({
  validateSearch: searchSchema,
  component: function ReleaseBucketsRoute() {
    const { practice } = Route.useSearch()
    return <ReleaseBucketsScreen practiceFilter={practice} />
  },
})
