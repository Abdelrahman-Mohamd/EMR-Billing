import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { VisitsScreen } from '@/features/visits'

/** `?practice=<id>`: the practice in view, as on the other practice-scoped screens. No PHI. */
const searchSchema = z.object({
  practice: z.coerce.number().int().positive().optional().catch(undefined),
})

export const Route = createFileRoute('/_app/visits/')({
  validateSearch: searchSchema,
  component: function VisitsRoute() {
    const search = Route.useSearch()
    return <VisitsScreen practiceFilter={search.practice} />
  },
})
