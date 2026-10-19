import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { SignInScreen, safeRedirect } from '@/features/auth'

/**
 * `?redirect=` is where to return after signing in. It is parsed leniently
 * here (a malformed value is dropped, not an error page) and made safe by the
 * feature before it is used — see `safeRedirect`. `?ended=` says why the
 * previous session ended when it did not end by signing out (the server
 * refused it, another tab signed out, the user's own password was changed) —
 * a word, no PHI.
 */
const searchSchema = z.object({
  redirect: z.string().optional().catch(undefined),
  ended: z.enum(['rejected', 'elsewhere', 'password-changed']).optional().catch(undefined),
})

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>) => searchSchema.parse(search),
  component: LoginRoute,
})

function LoginRoute() {
  const { redirect, ended } = Route.useSearch()
  return <SignInScreen redirectTo={safeRedirect(redirect)} {...(ended === undefined ? {} : { ended })} />
}
