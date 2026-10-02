import { createFileRoute, Outlet } from '@tanstack/react-router'
import { z } from 'zod'
import { EXCEPTION_LEVELS } from '@/features/exceptions'

/**
 * `?practice=<id>`: the practice in view, as on the other practice-scoped
 * screens. `?level=<level>`: open a list on one level (the prototype's deep
 * link). Opaque values, no PHI.
 */
const searchSchema = z.object({
  practice: z.coerce.number().int().positive().optional().catch(undefined),
  level: z.enum(EXCEPTION_LEVELS).optional().catch(undefined),
})

/** Exceptions: Billing exceptions, Incomplete profiles and Resolved, each its own URL. */
export const Route = createFileRoute('/_app/exceptions')({
  validateSearch: searchSchema,
  component: Outlet,
})
