import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { InsurancesScreen } from '@/features/admin-insurances'

/** `?practice=<id>`: the practice the list is filtered to. An opaque id, no PHI. */
const searchSchema = z.object({
  practice: z.coerce.number().int().positive().optional().catch(undefined),
})

export const Route = createFileRoute('/_app/setup/insurances')({
  validateSearch: searchSchema,
  component: function InsurancesRoute() {
    const { practice } = Route.useSearch()
    return <InsurancesScreen practiceFilter={practice} />
  },
})
