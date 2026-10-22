import { createFileRoute } from '@tanstack/react-router'
import { ExceptionsScreen } from '@/features/exceptions'

export const Route = createFileRoute('/_app/exceptions/')({
  component: function ExceptionsRoute() {
    const search = Route.useSearch()
    return <ExceptionsScreen practiceFilter={search.practice} type={search.type} reason={search.reason} />
  },
})
