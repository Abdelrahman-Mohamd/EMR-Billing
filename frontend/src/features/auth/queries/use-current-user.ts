import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'
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
 * the new person. No second copy anywhere. Shared with the route guard, which
 * checks a restored session with it.
 */
export const currentUserQuery = () =>
  queryOptions({
    queryKey: authKeys.currentUser(),
    queryFn: () => getCurrentUser(),
    staleTime: Infinity,
  })

export function useCurrentUser() {
  return useQuery(currentUserQuery())
}

/**
 * Sign out: tell the server, then — whatever it answered — drop everything the
 * session had cached and go to sign in (docs/SECURITY.md §2). Resolves with
 * whether the server confirmed it, so the caller can say so if it did not.
 */
export function useSignOut(): () => Promise<{ confirmed: boolean; message: string | null }> {
  const queryClient = useQueryClient()
  const router = useRouter()
  return async () => {
    let confirmed = true
    let message: string | null = null
    try {
      message = await signOut()
    } catch {
      confirmed = false
    }
    queryClient.clear()
    await router.navigate({ to: '/login', replace: true })
    return { confirmed, message }
  }
}
