import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { PatientChart } from '@/features/patients'
import { CaseVisitsAction, CaseVisitsList } from '@/features/visits'

/**
 * `?case=<id>`: the case the chart shows — an opaque id, no PHI. With none,
 * the first open case. A `#profile`, `#insurance`, `#case`, `#diagnoses` or
 * `#authorizations` in the address opens the chart at that part.
 */
const searchSchema = z.object({
  case: z.string().max(100).optional().catch(undefined),
})

/** A patient's chart: one page — the patient, their insurance, then their cases and the case's visits. */
export const Route = createFileRoute('/_app/patients/$patientId')({
  validateSearch: searchSchema,
  component: function PatientChartRoute() {
    const { patientId } = Route.useParams()
    const search = Route.useSearch()
    // The case's visits come from Visits; the chart only places them.
    return (
      <PatientChart
        patientId={patientId}
        caseId={search.case}
        visits={{ Action: CaseVisitsAction, List: CaseVisitsList }}
      />
    )
  },
})
