import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { InsuranceClassesScreen } from '@/features/admin-insurances'

/** `?practice=<id>`: the practice the list is filtered to. An opaque id, no PHI. */
const searchSchema = z.object({
  practice: z.coerce.number().int().positive().optional().catch(undefined),
})

export const Route = createFileRoute('/_app/setup/insurance-classes')({
  validateSearch: searchSchema,
  component: function InsuranceClassesRoute() {
    const { practice } = Route.useSearch()
    return <InsuranceClassesScreen practiceFilter={practice} />
  },
})
