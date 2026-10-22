import { createFileRoute, Outlet } from '@tanstack/react-router'
import { z } from 'zod'

/**
 * `?practice=<id>`: the practice in view, as on the other practice-scoped
 * screens. `?type=` and `?reason=`: the queue's type (`patient`, `case`,
 * `charge`) and reason (`zip_state_mismatch`) — the server's codes. Opaque
 * values, no PHI.
 */
const code = z
  .string()
  .regex(/^[a-z_]{1,64}$/)
  .optional()
  .catch(undefined)
const searchSchema = z.object({
  practice: z.coerce.number().int().positive().optional().catch(undefined),
  type: code,
  reason: code,
})

/** Exceptions: the server's billing exceptions, by type and reason. */
export const Route = createFileRoute('/_app/exceptions')({
  validateSearch: searchSchema,
  component: Outlet,
})
