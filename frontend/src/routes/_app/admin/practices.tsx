import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { PracticesScreen } from '@/features/admin-practices'

/** `?practice=<id>`: the practice whose details and locations are shown. An opaque id, no PHI. */
const searchSchema = z.object({
  practice: z.coerce.number().int().positive().optional().catch(undefined),
})

export const Route = createFileRoute('/_app/admin/practices')({
  validateSearch: searchSchema,
  component: function PracticesRoute() {
    const { practice } = Route.useSearch()
    return <PracticesScreen selectedId={practice} />
  },
})
