import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { CalendarCheck, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { CellSub, DataTable, type Column } from '@/components/ui/DataTable'
import { Pagination } from '@/components/ui/Pagination'
import { EmptyState } from '@/components/ui/States'
import { FilterBar, PageContainer, PageHeader } from '@/components/shared/PageLayout'
import { PracticeSelect } from '@/features/admin-practices'
import { formatIsoDate } from '@/lib/utils/dates'
import { amountText, codesSummary } from '../model/charge-line-text'
import { visitStatus } from '../model/visit-status'
import { useVisitReferences } from '../queries/use-visit-references'
import { useVisits } from '../queries/use-visits'
import type { Visit } from '../schemas/visit'
import { NewVisitDialog } from './NewVisitDialog'

const PAGE_SIZE = 12

/**
 * Visits: every visit with its patient and case, date of service, location,
 * treating provider, charge lines, total and status, newest first — as the
 * server lists them. A row opens the visit, where its lines and claims are.
 * The practice filter is in the URL (`?practice=`), as on the other
 * practice-scoped screens. No search and no sorting: the server takes neither
 * for visits (staging, 2026-10-20), and the list is never searched or ordered
 * in the browser (user, 2026-10-20).
 */
export function VisitsScreen({ practiceFilter }: { practiceFilter: number | undefined }) {
  const navigate = useNavigate()
  // The practice filter is the server's (`practice_id`).
  const visits = useVisits(practiceFilter === undefined ? {} : { practiceId: practiceFilter })
  const refs = useVisitReferences()
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)

  const setPractice = (value: string | null) =>
    void navigate({ to: '/visits', search: value === null ? {} : { practice: Number(value) } })
  const filtered = practiceFilter !== undefined

  const rows = visits.data ?? []
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const pageRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const summary =
    rows.length <= PAGE_SIZE
      ? `${rows.length} ${rows.length === 1 ? 'visit' : 'visits'}`
      : `Showing ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, rows.length)} of ${rows.length} visits`

  const columns: ReadonlyArray<Column<Visit>> = [
    {
      key: 'patient',
      header: 'Patient',
      primary: true,
      cell: (visit) => (
        <span className="block min-w-0">
          <span className="break-words">{refs.patientListName(visit)}</span>
          <CellSub>{visit.caseName}</CellSub>
        </span>
      ),
    },
    {
      key: 'date',
      header: 'Date of service',
      cell: (visit) => (
        <span className="whitespace-nowrap tabular-nums">{formatIsoDate(visit.dateOfService)}</span>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      cell: (visit) => visit.locationName || '—',
    },
    {
      key: 'provider',
      header: 'Treating provider',
      cell: (visit) => visit.treatingProvider?.name ?? refs.providerName(visit.treatingProviderId),
    },
    {
      key: 'lines',
      header: 'Charge lines',
      cell: (visit) =>
        visit.chargeLines.length === 0 ? (
          <span className="text-n400">—</span>
        ) : (
          <span className="tabular-nums">{codesSummary(visit.chargeLines, refs)}</span>
        ),
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      cell: (visit) => <span className="tabular-nums">{amountText(visit.totalAmount) || '—'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (visit) => {
        const status = visitStatus(visit.status)
        return <Badge tone={status.tone}>{status.label}</Badge>
      },
    },
  ]

  const newVisit = (
    <Button variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => setCreating(true)}>
      New visit
    </Button>
  )

  const clearAll = () => {
    setPage(1)
    if (practiceFilter !== undefined) setPractice(null)
  }

  return (
    <PageContainer>
      <PageHeader
        title="Visits"
        description="Record visits and their charge lines, then create claims from them."
        actions={newVisit}
      />

      <FilterBar {...(filtered ? { onReset: clearAll } : {})}>
        <PracticeSelect
          aria-label="Filter by practice"
          value={practiceFilter === undefined ? null : String(practiceFilter)}
          onChange={setPractice}
          placeholder="All practices"
          clearable
          className="w-full sm:w-64"
        />
      </FilterBar>

      <DataTable
        caption="Visits"
        columns={columns}
        rows={pageRows}
        getRowId={(visit) => String(visit.id)}
        loading={visits.isPending || !refs.ready}
        error={visits.isError}
        onRetry={() => void visits.refetch()}
        rowLink={(visit) => ({ to: '/visits/$visitId', params: { visitId: String(visit.id) } })}
        // A row opens the visit; "View visit" at its end says so, as on Patients.
        openHint="View visit"
        empty={
          filtered ? (
            <EmptyState
              icon={<CalendarCheck size={20} />}
              title="No visits match"
              description="Show every practice to see them all."
              action={<Button onClick={clearAll}>Show every practice</Button>}
            />
          ) : (
            <EmptyState
              icon={<CalendarCheck size={20} />}
              title="No visits yet"
              description="Record a visit on a patient’s case with its charge lines."
              action={newVisit}
            />
          )
        }
        footer={
          rows.length > 0 ? (
            <Pagination page={currentPage} pageCount={pageCount} onPageChange={setPage} summary={summary} />
          ) : undefined
        }
      />

      {creating && <NewVisitDialog onClose={() => setCreating(false)} />}
    </PageContainer>
  )
}
