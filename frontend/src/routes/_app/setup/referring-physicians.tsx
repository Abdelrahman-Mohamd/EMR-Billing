import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { ReferringPhysiciansScreen } from '@/features/admin-referring-physicians'

/** `?practice=<id>`: the practice the list is filtered to. An opaque id, no PHI. */
const searchSchema = z.object({
  practice: z.coerce.number().int().positive().optional().catch(undefined),
})

export const Route = createFileRoute('/_app/setup/referring-physicians')({
  validateSearch: searchSchema,
  component: function ReferringPhysiciansRoute() {
    const { practice } = Route.useSearch()
    return <ReferringPhysiciansScreen practiceFilter={practice} />
  },
})
