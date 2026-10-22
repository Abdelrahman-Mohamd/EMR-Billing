import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronRight, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/States'
import { formatIsoDate } from '@/lib/utils/dates'
import { amountText, codesSummary } from '../model/charge-line-text'
import { visitStatus } from '../model/visit-status'
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
  // Only this case's, asked of the server (`case_id`).
  const visits = useVisits({ caseId })
  const refs = useVisitReferences()
  if (visits.isPending) return null
  if (visits.isError) return <ErrorState onRetry={() => void visits.refetch()} />
  // In the server's order (newest first): it takes no sort.
  const mine = visits.data
  if (mine.length === 0)
    return (
      <p className="text-meta text-n500 pt-3 leading-snug">
        <span className="text-ink font-medium">No visits on this case yet</span>. Record one with its charge
        lines.
      </p>
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
              <span className="text-meta text-ink flex flex-wrap items-center gap-x-2 gap-y-1 font-medium tabular-nums">
                {formatIsoDate(visit.dateOfService)}
                <Badge tone={visitStatus(visit.status).tone}>{visitStatus(visit.status).label}</Badge>
              </span>
              <span className="text-micro text-n500 block break-words">
                {[
                  visit.locationName,
                  visit.treatingProvider?.name ?? refs.providerName(visit.treatingProviderId),
                  codesSummary(visit.chargeLines, refs),
                  amountText(visit.totalAmount),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>
            <ChevronRight size={16} aria-hidden="true" className="text-n400 flex-none" />
          </Link>
        </li>
      ))}
    </ul>
  )
}
