import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { EmrIntegrationScreen } from '@/features/admin-emr-integration'

/** `?practice=<id>`: the practice whose locations are shown. An opaque id, no PHI. */
const searchSchema = z.object({
  practice: z.coerce.number().int().positive().optional().catch(undefined),
})

export const Route = createFileRoute('/_app/admin/integration')({
  validateSearch: searchSchema,
  component: function EmrIntegrationRoute() {
    const { practice } = Route.useSearch()
    return <EmrIntegrationScreen practiceFilter={practice} />
  },
})
