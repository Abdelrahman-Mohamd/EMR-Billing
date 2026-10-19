import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { onSessionEnd } from '@/lib/auth/session'

/**
 * While the signed-in app is open: when the session ends without this tab
 * signing out — the server refused it (an admin changed the password,
 * deactivated or deleted the user, it expired), another tab signed out, or the
 * user saved their own new password — go to sign-in at once and say why, then
 * come back here. Nothing cached for the old session is kept. (User,
 * 2026-10-19: a dead session left the screen on a "Try again" that could not
 * work, until a refresh.)
 */
export function useSessionEndRedirect(): void {
  const router = useRouter()
  const queryClient = useQueryClient()
  useEffect(
    () =>
      onSessionEnd((reason) => {
        const here = router.state.location.href
        queryClient.clear()
        void router.navigate({ to: '/login', search: { redirect: here, ended: reason }, replace: true })
      }),
    [router, queryClient],
  )
}
