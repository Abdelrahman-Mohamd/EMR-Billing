import { createFileRoute, redirect } from '@tanstack/react-router'

/**
 * `/` — where signing in lands, the logo leads and "Back to the start" goes —
 * opens the first module, Patients, as `/admin` opens its first section. The
 * development placeholder page that stood here is gone; there is no
 * dashboard to show yet.
 */
export const Route = createFileRoute('/_app/')({
  beforeLoad: () => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- redirect() is TanStack Router's control flow, not an error.
    throw redirect({ to: '/patients', replace: true })
  },
})
