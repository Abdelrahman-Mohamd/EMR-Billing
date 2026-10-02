import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { PatientsScreen } from '@/features/patients'

/**
 * `?practice=<id>`: the practice the roster is filtered to. An opaque id, no
 * PHI — the search text and the other filters stay in the screen.
 */
const searchSchema = z.object({
  practice: z.coerce.number().int().positive().optional().catch(undefined),
})

export const Route = createFileRoute('/_app/patients/')({
  validateSearch: searchSchema,
  component: function PatientsRoute() {
    const { practice } = Route.useSearch()
    return <PatientsScreen practiceFilter={practice} />
  },
})
