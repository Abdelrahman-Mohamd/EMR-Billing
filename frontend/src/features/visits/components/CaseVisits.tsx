import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { formatIsoDate } from '@/lib/utils/dates'
import { codesSummary } from '../model/charge-line-text'
import { useVisitReferences } from '../queries/use-visit-references'
import { useVisits } from '../queries/use-visits'
import { NewVisitDialog } from './NewVisitDialog'

/**
 * A case's visits, for the patient chart's case part: Case → Visit. Each one
 * opens its visit, where its charge lines and claims are. The patient chart
 * places these (its route hands them over), so Patients does not depend on
 * Visits.
 */
export function CaseVisitsAction({ caseId }: { caseId: string }) {
  const [creating, setCreating] = useState(false)
  return (
    <>
      <Button size="sm" icon={<Plus size={14} aria-hidden="true" />} onClick={() => setCreating(true)}>
        New visit
      </Button>
      {/* Opens on this case. */}
      {creating && <NewVisitDialog caseId={caseId} onClose={() => setCreating(false)} />}
    </>
  )
}

export function CaseVisitsList({ caseId }: { caseId: string }) {
  const visits = useVisits()
  const refs = useVisitReferences()
  if (visits.isPending) return null
  if (visits.isError) return <ErrorState onRetry={() => void visits.refetch()} />
  const mine = visits.data
    .filter((visit) => String(visit.caseId) === caseId)
    .sort((a, b) => b.dateOfService.localeCompare(a.dateOfService))
  if (mine.length === 0)
    return (
      <div className="pt-3">
        <EmptyState title="No visits on this case yet" description="Record one with its charge lines." />
      </div>
    )
  return (
    <ul className="mt-1" aria-label="Visits on this case">
      {mine.map((visit) => (
        <li key={visit.id} className="border-rule-row border-t first:border-t-0">
          <Link
            to="/visits/$visitId"
            params={{ visitId: String(visit.id) }}
            className="hover:bg-n50 -mx-2 flex items-center gap-3 rounded-sm px-2 py-3 no-underline"
          >
            <span className="min-w-0 flex-1">
              <span className="text-meta text-ink block font-medium tabular-nums">
                {formatIsoDate(visit.dateOfService)}
              </span>
              <span className="text-micro text-n500 block break-words">
                {refs.locationName(visit.locationId)} · {refs.providerName(visit.treatingProviderId)}
                {visit.chargeLines.length > 0 && ` · ${codesSummary(visit.chargeLines)}`}
              </span>
            </span>
            <ChevronRight size={16} aria-hidden="true" className="text-n400 flex-none" />
          </Link>
        </li>
      ))}
    </ul>
  )
}
