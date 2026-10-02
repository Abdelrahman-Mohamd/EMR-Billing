import { createFileRoute } from '@tanstack/react-router'
import { ExceptionsScreen } from '@/features/exceptions'

export const Route = createFileRoute('/_app/exceptions/incomplete')({
  component: function ExceptionsRoute() {
    const search = Route.useSearch()
    return <ExceptionsScreen tab="incomplete" practiceFilter={search.practice} level={search.level} />
  },
})
