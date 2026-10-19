import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { AppShell } from '@/app/layouts/AppShell'
import { navigationGroups } from '@/app/layouts/navigation'
import { AccountMenu, currentUserQuery, useSessionEndRedirect } from '@/features/auth'
import { isApiError } from '@/lib/api/api-error'
import { hasSession } from '@/lib/auth/session'
import { env } from '@/lib/config/env'

/**
 * The signed-in application: every screen under here gets the rail. Sign-in
 * sits outside it, at the root.
 *
 * The guard: with a backend configured (`.env`), a visit without a session (no
 * access token — never signed in, signed out, or a `401`) goes to
 * `/login?redirect=…`, and every screen below is covered at once
 * (docs/FRONTEND_ARCHITECTURE.md §8, ADR 0007). A session restored from
 * storage may hold a token the server has since dropped, so the guard asks
 * who is signed in (`GET /auth/me`, once — then cached; right after sign-in
 * it is already known) and sends a refused token to sign in too. Any other
 * failure lets the app load: its screens show their own error states. Once
 * in, a session that ends by itself (a refused request, another tab signing
 * out) goes to sign-in at once, saying why (`useSessionEndRedirect`). Without
 * a backend (the tests) there is no session to check. The server enforces
 * access on every request regardless; this only spares the user a screen that
 * cannot load.
 */
export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ location, context }) => {
    if (!env.isLive) return
    const toSignIn = (ended?: 'rejected') =>
      redirect({
        to: '/login',
        search: { redirect: location.href, ...(ended === undefined ? {} : { ended }) },
        replace: true,
      })
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- redirect() is TanStack Router's control flow, not an error.
    if (!hasSession()) throw toSignIn()
    try {
      await context.queryClient.ensureQueryData({ ...currentUserQuery(), retry: false })
    } catch (error) {
      // A restored session the server no longer accepts: say so on the sign-in page.
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- as above.
      if (isApiError(error) && error.kind === 'unauthenticated') throw toSignIn('rejected')
    }
  },
  component: AppLayout,
})

function AppLayout() {
  useSessionEndRedirect()
  return (
    <AppShell
      groups={navigationGroups()}
      railFooter={({ expanded, placement }) => <AccountMenu expanded={expanded} placement={placement} />}
    >
      <Outlet />
    </AppShell>
  )
}
