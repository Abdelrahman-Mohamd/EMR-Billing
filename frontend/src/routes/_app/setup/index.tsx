import { createFileRoute, redirect } from '@tanstack/react-router'

/** `/setup` on its own opens the first section, as the prototype does. */
export const Route = createFileRoute('/_app/setup/')({
  beforeLoad: () => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- redirect() is TanStack Router's control flow, not an error.
    throw redirect({ to: '/setup/providers', replace: true })
  },
})
