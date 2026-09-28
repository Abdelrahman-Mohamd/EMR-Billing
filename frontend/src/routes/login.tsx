import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { SignInScreen, safeRedirect } from '@/features/auth'

/**
 * `?redirect=` is where to return after signing in. It is parsed leniently
 * here (a malformed value is dropped, not an error page) and made safe by the
 * feature before it is used — see `safeRedirect`.
 */
const searchSchema = z.object({
  redirect: z.string().optional().catch(undefined),
})

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>) => searchSchema.parse(search),
  component: LoginRoute,
})

function LoginRoute() {
  const { redirect } = Route.useSearch()
  return <SignInScreen redirectTo={safeRedirect(redirect)} />
}
