import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { ProvidersScreen } from '@/features/admin-providers'

/** `?practice=<id>`: the practice the list is filtered to. An opaque id, no PHI. */
const searchSchema = z.object({
  practice: z.coerce.number().int().positive().optional().catch(undefined),
})

export const Route = createFileRoute('/_app/setup/providers')({
  validateSearch: searchSchema,
  component: function ProvidersRoute() {
    const { practice } = Route.useSearch()
    return <ProvidersScreen practiceFilter={practice} />
  },
})
