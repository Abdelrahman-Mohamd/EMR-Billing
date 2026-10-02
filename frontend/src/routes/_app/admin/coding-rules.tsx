import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { CodingRulesScreen } from '@/features/admin-coding-rules'

/** `?practice=<id>`: the practice whose rules are shown. An opaque id, no PHI. */
const searchSchema = z.object({
  practice: z.coerce.number().int().positive().optional().catch(undefined),
})

export const Route = createFileRoute('/_app/admin/coding-rules')({
  validateSearch: searchSchema,
  component: function CodingRulesRoute() {
    const { practice } = Route.useSearch()
    return <CodingRulesScreen practiceFilter={practice} />
  },
})
