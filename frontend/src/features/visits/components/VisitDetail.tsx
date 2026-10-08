import { useState, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, FileText, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Section } from '@/components/ui/Card'
import { CellSub, DataTable, type Column } from '@/components/ui/DataTable'
import { KeyValue } from '@/components/ui/KeyValue'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { PageContainer, PageHeader } from '@/components/shared/PageLayout'
import { formatIsoDate } from '@/lib/utils/dates'
import { modifiersText, pointersText } from '../model/charge-line-text'
import { useVisitReferences } from '../queries/use-visit-references'
import { useVisits } from '../queries/use-visits'
import type { ChargeLine, Visit } from '../schemas/visit'
import { AddChargeLineDialog } from './AddChargeLineDialog'

const backLink = (
  <Link
    to="/visits"
    className="text-micro text-brand-deep hover:text-ink relative inline-flex items-center gap-1.5 font-medium no-underline after:absolute after:-inset-x-1 after:-inset-y-2.5 after:content-['']"
  >
    <ArrowLeft size={14} aria-hidden="true" />
    Visits
  </Link>
)

/**
 * One visit: who and when (the patient and case — with a way back to the
 * chart — the date of service, location, billing and treating providers and
 * the authorization), its charge lines with "Add charge line", then what the
 * route places under it: the visit's claims (`claims`, from Claims — kept out
 * of this feature so each depends one way only).
 *
 * No payload exists for changing or removing a visit or a line, so the page
 * offers neither.
 */
export function VisitDetail({ visitId, claims }: { visitId: number; claims?: (visit: Visit) => ReactNode }) {
  const visits = useVisits()
  const refs = useVisitReferences()
  const [adding, setAdding] = useState(false)

  if (visits.isPending) return <PageContainer>{null}</PageContainer>
  if (visits.isError)
    return (
      <PageContainer>
        <PageHeader title="Visit" above={backLink} />
        <ErrorState onRetry={() => void visits.refetch()} />
      </PageContainer>
    )
  const visit = visits.data.find((item) => item.id === visitId)
  if (visit === undefined)
    return (
      <PageContainer>
        <div className="pt-8">
          <EmptyState
            icon={<FileText size={20} />}
            title="Visit not found"
            description="This visit is not in the list."
            action={
              <Link to="/visits" className="text-brand-deep font-medium">
                Back to visits
              </Link>
            }
          />
        </div>
      </PageContainer>
    )

  const patient = refs.patientOf(visit.caseId)
  const columns: ReadonlyArray<Column<ChargeLine>> = [
    {
      key: 'code',
      header: 'Procedure',
      primary: true,
      cell: (line) => {
        const procedure = refs.procedure(line.procedureCode)
        return (
          <span className="block min-w-0">
            <span className="tabular-nums">{procedure.code}</span>
            {procedure.description !== '' && <CellSub>{procedure.description}</CellSub>}
          </span>
        )
      },
    },
    { key: 'units', header: 'Units', cell: (line) => <span className="tabular-nums">{line.units}</span> },
    {
      key: 'modifiers',
      header: 'Modifiers',
      cell: (line) => modifiersText(line) || <span className="text-n400">—</span>,
    },
    {
      key: 'pointers',
      header: 'Diagnosis pointers',
      cell: (line) => pointersText(line, visit.caseId, refs) || <span className="text-n400">—</span>,
    },
  ]

  return (
    <PageContainer>
      <PageHeader
        title={`${refs.patientFullName(visit.caseId)} · ${formatIsoDate(visit.dateOfService)}`}
        description={
          <span className="flex flex-wrap gap-x-2">
            <span>{refs.caseName(visit.caseId)}</span>
            {patient !== undefined && (
              <>
                <span aria-hidden="true">·</span>
                <Link
                  to="/patients/$patientId"
                  params={{ patientId: patient.id }}
                  search={{ case: String(visit.caseId) }}
                  hash="case"
                  // An invisible hit box around the short link, as the back links have.
                  className="text-brand-deep relative font-medium after:absolute after:-inset-x-1 after:-inset-y-2.5 after:content-['']"
                >
                  Open chart
                </Link>
              </>
            )}
          </span>
        }
        above={backLink}
      />

      <Section title="Visit details">
        <KeyValue
          items={[
            { label: 'Patient', value: refs.patientFullName(visit.caseId) },
            { label: 'Case', value: refs.caseName(visit.caseId) },
            { label: 'Date of service', value: formatIsoDate(visit.dateOfService) },
            { label: 'Location', value: refs.locationName(visit.locationId) },
            { label: 'Billing provider', value: refs.providerName(visit.billingProviderId) },
            { label: 'Treating provider', value: refs.providerName(visit.treatingProviderId) },
            { label: 'Authorization', value: refs.authorizationLabel(visit.authorizationId) || 'None' },
          ]}
        />
      </Section>

      <Section
        title="Charge lines"
        aside={
          <Button size="sm" icon={<Plus size={14} aria-hidden="true" />} onClick={() => setAdding(true)}>
            Add charge line
          </Button>
        }
      >
        <DataTable
          className="mt-2"
          caption={`Charge lines of the visit on ${formatIsoDate(visit.dateOfService)}`}
          columns={columns}
          rows={visit.chargeLines}
          getRowId={(line) => String(line.id)}
          empty={
            <div className="pt-4">
              <EmptyState
                icon={<FileText size={20} />}
                title="No charge lines on this visit"
                description="Add the procedures performed."
              />
            </div>
          }
        />
      </Section>

      {claims?.(visit)}

      {adding && <AddChargeLineDialog visit={visit} onClose={() => setAdding(false)} />}
    </PageContainer>
  )
}
