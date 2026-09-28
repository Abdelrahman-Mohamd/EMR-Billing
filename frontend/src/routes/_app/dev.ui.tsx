import { lazy, Suspense } from 'react'
import { createFileRoute, notFound } from '@tanstack/react-router'

/**
 * The component showcase route.
 *
 * The page itself is imported only inside a `import.meta.env.DEV` branch, so a
 * production build removes the branch and never emits the chunk: the developer
 * tool is absent from the bundle, not merely unreachable
 * (docs/SECURITY.md "Configuration and build"). The route stays in the tree in
 * both builds so links to it remain type-checked.
 */
const ShowcasePage = import.meta.env.DEV
  ? lazy(() => import('@/dev/ShowcasePage'))
  : function Missing() {
      return null
    }

export const Route = createFileRoute('/_app/dev/ui')({
  beforeLoad: () => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- notFound() is TanStack Router's control flow, not an error.
    if (!import.meta.env.DEV) throw notFound()
  },
  component: () => (
    <Suspense fallback={null}>
      <ShowcasePage />
    </Suspense>
  ),
})
