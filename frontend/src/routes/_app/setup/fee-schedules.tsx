import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { FeeSchedulesScreen } from '@/features/admin-fee-schedules'

/** `?insurance=<id>`: the insurance whose rows are shown. An opaque id, no PHI. */
const searchSchema = z.object({
  insurance: z.coerce.number().int().positive().optional().catch(undefined),
})

export const Route = createFileRoute('/_app/setup/fee-schedules')({
  validateSearch: searchSchema,
  component: function FeeSchedulesRoute() {
    const { insurance } = Route.useSearch()
    return <FeeSchedulesScreen insuranceFilter={insurance} />
  },
})
