import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { ClaimsScreen } from '@/features/claims'

/** `?practice=<id>`: the practice in view, as on the other practice-scoped screens. No PHI. */
const searchSchema = z.object({
  practice: z.coerce.number().int().positive().optional().catch(undefined),
})

export const Route = createFileRoute('/_app/claims')({
  validateSearch: searchSchema,
  component: function ClaimsRoute() {
    const search = Route.useSearch()
    return <ClaimsScreen practiceFilter={search.practice} />
  },
})
