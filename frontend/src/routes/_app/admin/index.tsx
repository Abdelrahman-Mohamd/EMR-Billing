import { createFileRoute, redirect } from '@tanstack/react-router'

/** `/admin` on its own opens the first section, as the prototype does. */
export const Route = createFileRoute('/_app/admin/')({
  beforeLoad: () => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- redirect() is TanStack Router's control flow, not an error.
    throw redirect({ to: '/admin/organizations', replace: true })
  },
})
