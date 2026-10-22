import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Send } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button, buttonClass } from '@/components/ui/Button'
import { CellSub, DataTable, type Column } from '@/components/ui/DataTable'
import { Pagination } from '@/components/ui/Pagination'
import { EmptyState } from '@/components/ui/States'
import { FilterBar, PageContainer, PageHeader } from '@/components/shared/PageLayout'
import { PracticeSelect } from '@/features/admin-practices'
import { useVisitReferences } from '@/features/visits'
import { formatIsoDate } from '@/lib/utils/dates'
import { formatMoney } from '@/lib/utils/money'
import { useClaims } from '../queries/use-claims'
import { claimStatus, formatName, type Claim } from '../schemas/claim'

const PAGE_SIZE = 12

/**
 * Claims: every claim as the server lists it — the patient and date of
 * service of the visit billed, the insurance billed (with its priority), the
 * format, total, status (with what the scrub found) and when it was sent.
 * A row opens its visit, where the claim is edited or deleted. Claims are made
 * from a released visit, so there is no "New claim" here. The practice filter
 * is in the URL (`?practice=`). No search and no sorting: the server takes
 * neither for claims (staging, 2026-10-20), and the list is never searched or
 * ordered in the browser (user, 2026-10-20).
 */
export function ClaimsScreen({ practiceFilter }: { practiceFilter: number | undefined }) {
  const navigate = useNavigate()
  const claims = useClaims()
  const refs = useVisitReferences()
  const [page, setPage] = useState(1)

  const setPractice = (value: string | null) =>
    void navigate({ to: '/claims', search: value === null ? {} : { practice: Number(value) } })
  const filtered = practiceFilter !== undefined

  const rows = (claims.data ?? []).filter(
    (claim) => practiceFilter === undefined || refs.practiceOf(claim) === practiceFilter,
  )
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const pageRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const summary =
    rows.length <= PAGE_SIZE
      ? `${rows.length} ${rows.length === 1 ? 'claim' : 'claims'}`
      : `Showing ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, rows.length)} of ${rows.length} claims`

  const columns: ReadonlyArray<Column<Claim>> = [
    {
      key: 'patient',
      header: 'Patient',
      primary: true,
      cell: (claim) => <span className="break-words">{refs.patientListName(claim)}</span>,
    },
    {
      key: 'date',
      header: 'Date of service',
      cell: (claim) => (
        <span className="whitespace-nowrap tabular-nums">
          {claim.dateOfService === '' ? '—' : formatIsoDate(claim.dateOfService)}
        </span>
      ),
    },
    {
      key: 'insurance',
      header: 'Insurance',
      cell: (claim) => (
        <span className="block min-w-0">
          <span className="break-words">{claim.insuranceName || '—'}</span>
          {claim.rankLabel !== '' && <CellSub>{claim.rankLabel}</CellSub>}
        </span>
      ),
    },
    {
      key: 'number',
      header: 'Claim #',
      cell: (claim) => (
        <span className="block min-w-0">
          <span className="tabular-nums">{claim.controlNumber || '—'}</span>
          {claim.payerClaimNumber !== '' && <CellSub>Payer # {claim.payerClaimNumber}</CellSub>}
        </span>
      ),
    },
    { key: 'format', header: 'Format', cell: (claim) => formatName(claim.format) },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      cell: (claim) => {
        const value = Number(claim.totalAmount)
        return (
          <span className="tabular-nums">
            {claim.totalAmount === '' || Number.isNaN(value) ? '—' : formatMoney(value)}
          </span>
        )
      },
    },
    {
      key: 'status',
      header: 'Status',
      cell: (claim) => {
        const status = claimStatus(claim.status)
        return (
          <span className="block min-w-0">
            <Badge tone={status.tone}>{status.label}</Badge>
            {claim.scrubErrors.length > 0 && (
              <CellSub>
                <span className="text-critical">
                  {claim.scrubErrors.length === 1
                    ? '1 scrub error'
                    : `${claim.scrubErrors.length} scrub errors`}
                </span>
              </CellSub>
            )}
          </span>
        )
      },
    },
    {
      key: 'sent',
      header: 'Sent',
      cell: (claim) => (
        <span className="block min-w-0">
          <span className="whitespace-nowrap tabular-nums">
            {claim.sentDate === '' ? '—' : formatIsoDate(claim.sentDate)}
          </span>
          {claim.clearinghouseRef !== '' && <CellSub>Ref. {claim.clearinghouseRef}</CellSub>}
          {(claim.clearinghouseStatus !== '' || claim.clearinghouseBatchId !== '') && (
            <CellSub>
              {[
                claim.clearinghouseStatus,
                claim.clearinghouseBatchId === '' ? '' : `batch ${claim.clearinghouseBatchId}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </CellSub>
          )}
        </span>
      ),
    },
  ]

  const clearAll = () => {
    setPage(1)
    if (practiceFilter !== undefined) setPractice(null)
  }

  return (
    <PageContainer>
      <PageHeader title="Claims" description="Follow each visit’s claims, from scrubbing to payment." />

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
        caption="Claims"
        columns={columns}
        rows={pageRows}
        getRowId={(claim) => String(claim.id)}
        loading={claims.isPending || !refs.ready}
        error={claims.isError}
        onRetry={() => void claims.refetch()}
        rowLink={(claim) => ({ to: '/visits/$visitId', params: { visitId: String(claim.visitId) } })}
        // A row opens the claim's visit, where its claims are; "View visit" says so, as on Patients.
        openHint="View visit"
        empty={
          filtered ? (
            <EmptyState
              icon={<Send size={20} />}
              title="No claims match"
              description="Show every practice to see them all."
              action={<Button onClick={clearAll}>Show every practice</Button>}
            />
          ) : (
            <EmptyState
              icon={<Send size={20} />}
              title="No claims yet"
              description="A claim is created from a released visit, on the visit."
              action={
                <Link to="/visits" className={buttonClass('default')}>
                  Go to visits
                </Link>
              }
            />
          )
        }
        footer={
          rows.length > 0 ? (
            <Pagination page={currentPage} pageCount={pageCount} onPageChange={setPage} summary={summary} />
          ) : undefined
        }
      />
    </PageContainer>
  )
}
