import { createFileRoute } from '@tanstack/react-router'
import { ExceptionsScreen } from '@/features/exceptions'

export const Route = createFileRoute('/_app/exceptions/')({
  component: function ExceptionsRoute() {
    const search = Route.useSearch()
    return <ExceptionsScreen tab="open" practiceFilter={search.practice} level={search.level} />
  },
})
