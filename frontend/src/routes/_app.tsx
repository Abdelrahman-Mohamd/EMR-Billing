import { createFileRoute, Outlet } from '@tanstack/react-router'
import { AppShell } from '@/app/layouts/AppShell'
import { navigationGroups } from '@/app/layouts/navigation'
import { AccountMenu } from '@/features/auth'

/**
 * The signed-in application: every screen under here gets the rail. Sign-in
 * sits outside it, at the root.
 *
 * No route guard yet. The sign-in payload is known, but not how the session is
 * carried or read back (Q-025), so there is nothing to check; when there is, `beforeLoad` here
 * redirects to `/login?redirect=…` and every screen below is covered at once
 * (docs/FRONTEND_ARCHITECTURE.md §8, ADR 0007).
 */
export const Route = createFileRoute('/_app')({
  component: AppLayout,
})

function AppLayout() {
  return (
    <AppShell groups={navigationGroups()} railFooter={({ expanded }) => <AccountMenu expanded={expanded} />}>
      <Outlet />
    </AppShell>
  )
}
