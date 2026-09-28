import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { getCurrentUser, signOut } from '../api/auth-api'

/** Every key for this domain, built in one place (docs/FRONTEND_ARCHITECTURE.md §5). */
export const authKeys = {
  all: ['auth'] as const,
  currentUser: () => [...authKeys.all, 'current-user'] as const,
}

/**
 * Who is signed in. Server state like any other, so it lives in the query
 * cache: sign-in and sign-out clear the cache, and the next reader fetches
 * the new person. No second copy anywhere.
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: authKeys.currentUser(),
    queryFn: ({ signal }) => getCurrentUser(signal),
    staleTime: Infinity,
  })
}

/**
 * Sign out: tell the server, then — whatever it answered — drop everything the
 * session had cached and go to sign in (docs/SECURITY.md §2). Resolves with
 * whether the server confirmed it, so the caller can say so if it did not.
 */
export function useSignOut(): () => Promise<{ confirmed: boolean }> {
  const queryClient = useQueryClient()
  const router = useRouter()
  return async () => {
    let confirmed = true
    try {
      await signOut()
    } catch {
      confirmed = false
    }
    queryClient.clear()
    await router.navigate({ to: '/login', replace: true })
    return { confirmed }
  }
}
