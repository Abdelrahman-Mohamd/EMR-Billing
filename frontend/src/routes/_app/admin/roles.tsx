import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { RolesScreen } from '@/features/admin-roles'

/** `?role=<id>`: the role whose permissions are shown. A local id such as PRACTICE_ADMIN, no PHI. */
const searchSchema = z.object({
  role: z
    .string()
    .regex(/^[A-Z0-9_]{1,200}$/)
    .optional()
    .catch(undefined),
})

export const Route = createFileRoute('/_app/admin/roles')({
  validateSearch: searchSchema,
  component: function RolesRoute() {
    const { role } = Route.useSearch()
    return <RolesScreen roleFilter={role} />
  },
})
