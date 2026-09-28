import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { PageContainer } from '@/components/shared/PageLayout'

/**
 * Router context is how a route reaches shared services without importing the
 * app's singletons: loaders read `context.queryClient` and get the same cache
 * the components use. Auth and permissions join this object when they exist.
 */
export interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFound,
  errorComponent: RouteError,
})

/**
 * Deliberately bare: the rail belongs to the signed-in application
 * (`_app.tsx`), and sign-in lives outside it. Toasts are the one thing every
 * page shares.
 */
function RootLayout() {
  return (
    <>
      <Outlet />
      <Toaster />
    </>
  )
}

function NotFound() {
  return (
    <PageContainer>
      <EmptyState
        headingLevel={1}
        title="Page not found"
        description="That address does not match anything in this application."
        action={
          <Link to="/">
            <Button variant="primary">Back to the start</Button>
          </Link>
        }
      />
    </PageContainer>
  )
}

/**
 * Last line of defence for a render or loader failure. It shows what the user
 * can do, never the underlying error text — see docs/SECURITY.md
 * "Error messages".
 */
function RouteError() {
  return (
    <PageContainer>
      <ErrorState
        headingLevel={1}
        title="This screen could not be loaded"
        description="Try again, and tell support what you were doing if it keeps happening."
        onRetry={() => window.location.reload()}
      />
    </PageContainer>
  )
}
