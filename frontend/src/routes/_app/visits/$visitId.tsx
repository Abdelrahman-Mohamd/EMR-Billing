import { createFileRoute } from '@tanstack/react-router'
import { VisitClaims } from '@/features/claims'
import { VisitDetail } from '@/features/visits'

/** One visit: its details and charge lines (Visits), then its claims (Claims). */
export const Route = createFileRoute('/_app/visits/$visitId')({
  component: function VisitRoute() {
    const { visitId } = Route.useParams()
    return <VisitDetail visitId={Number(visitId)} claims={(visit) => <VisitClaims visit={visit} />} />
  },
})
