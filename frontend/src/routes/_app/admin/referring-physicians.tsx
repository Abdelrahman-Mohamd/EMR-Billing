import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'

/** Referring physicians moved from Admin to Setup (client, 2026-09-30); an old link still lands there. */
export const Route = createFileRoute('/_app/admin/referring-physicians')({
  validateSearch: z.object({ practice: z.coerce.number().int().positive().optional().catch(undefined) }),
  beforeLoad: ({ search }) => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- redirect() is TanStack Router's control flow, not an error.
    throw redirect({ to: '/setup/referring-physicians', search, replace: true })
  },
})
