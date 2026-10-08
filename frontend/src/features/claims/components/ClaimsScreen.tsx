import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Send } from 'lucide-react'
import { Button, buttonClass } from '@/components/ui/Button'
import { CellSub, DataTable, type Column, type Sort } from '@/components/ui/DataTable'
import { SearchInput } from '@/components/ui/Input'
import { Pagination } from '@/components/ui/Pagination'
import { EmptyState } from '@/components/ui/States'
import { FilterBar, PageContainer, PageHeader } from '@/components/shared/PageLayout'
import { PracticeSelect } from '@/features/admin-practices'
import { lineCode, modifiersText, pointersText, useVisitReferences, useVisits } from '@/features/visits'
import { formatIsoDate } from '@/lib/utils/dates'
import { useClaims } from '../queries/use-claims'
import type { Claim } from '../schemas/claim'

const PAGE_SIZE = 12

/**
 * Claims: every claim with the visit and procedure line it was made from —
 * patient, case and date of service, then the code, units, modifiers and
 * diagnosis pointers. A row opens its visit, where the claim sits with the
 * visit's charge lines. Claims are created from a visit, so there is no "New
 * claim" here. No status, number or amount is shown: none is in the payload.
 */
export function ClaimsScreen({ practiceFilter }: { practiceFilter: number | undefined }) {
  const navigate = useNavigate()
  const claims = useClaims()
  const visits = useVisits()
  const refs = useVisitReferences()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<Sort>({ key: 'date', direction: 'desc' })
  const [page, setPage] = useState(1)

  const visitOf = (claim: Claim) => visits.data?.find((visit) => visit.id === claim.visitId)
  const setPractice = (value: string | null) =>
    void navigate({ to: '/claims', search: value === null ? {} : { practice: Number(value) } })
  const query = search.trim().toLowerCase()
  const filtered = query !== '' || practiceFilter !== undefined

  const rows = (claims.data ?? [])
    .filter((claim) => {
      const visit = visitOf(claim)
      return (
        practiceFilter === undefined ||
        (visit !== undefined && refs.patientOf(visit.caseId)?.practiceId === practiceFilter)
      )
    })
    .filter((claim) => {
      if (query === '') return true
      const visit = visitOf(claim)
      const texts = [String(claim.procedureCode)]
      if (visit !== undefined)
        texts.push(
          refs.patientListName(visit.caseId),
          refs.patientFullName(visit.caseId),
          refs.caseName(visit.caseId),
        )
      return texts.some((text) => text.toLowerCase().includes(query))
    })
    .sort((a, b) => {
      const key = (claim: Claim) => {
        const visit = visitOf(claim)
        if (sort.key === 'patient')
          return visit === undefined ? '' : refs.patientListName(visit.caseId).toLowerCase()
        return visit?.dateOfService ?? ''
      }
      const order = key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : b.id - a.id
      return sort.direction === 'asc' ? order : -order
    })
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
      header: 'Visit',
      sortable: true,
      primary: true,
      cell: (claim) => {
        const visit = visitOf(claim)
        if (visit === undefined) return 'Visit'
        return (
          <span className="block min-w-0">
            <span className="break-words">{refs.patientListName(visit.caseId)}</span>
            <CellSub>{refs.caseName(visit.caseId)}</CellSub>
          </span>
        )
      },
    },
    {
      key: 'date',
      header: 'Date of service',
      sortable: true,
      cell: (claim) => {
        const visit = visitOf(claim)
        return (
          <span className="whitespace-nowrap tabular-nums">
            {visit === undefined ? '' : formatIsoDate(visit.dateOfService)}
          </span>
        )
      },
    },
    {
      key: 'procedure',
      header: 'Procedure',
      cell: (claim) => {
        const procedure = refs.procedure(claim.procedureCode)
        return (
          <span className="block min-w-0">
            <span className="whitespace-nowrap tabular-nums">{lineCode(claim)}</span>
            {procedure.description !== '' && <CellSub>{procedure.description}</CellSub>}
          </span>
        )
      },
    },
    {
      key: 'modifiers',
      header: 'Modifiers',
      cell: (claim) => modifiersText(claim) || <span className="text-n400">—</span>,
    },
    {
      key: 'pointers',
      header: 'Diagnosis pointers',
      cell: (claim) => {
        const visit = visitOf(claim)
        return (
          (visit === undefined ? '' : pointersText(claim, visit.caseId, refs)) || (
            <span className="text-n400">—</span>
          )
        )
      },
    },
  ]

  const clearAll = () => {
    setSearch('')
    setPage(1)
    if (practiceFilter !== undefined) setPractice(null)
  }

  return (
    <PageContainer>
      <PageHeader title="Claims" description="Review the claims created from visits’ charge lines." />

      <FilterBar
        search={
          <SearchInput
            aria-label="Search by patient, case or procedure code"
            placeholder="Search by patient, case or procedure code…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            autoComplete="off"
          />
        }
        {...(filtered ? { onReset: clearAll } : {})}
      >
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
        loading={claims.isPending || visits.isPending || !refs.ready}
        error={claims.isError || visits.isError}
        onRetry={() => {
          void claims.refetch()
          void visits.refetch()
        }}
        sort={sort}
        onSortChange={(next) => {
          setSort(next)
          setPage(1)
        }}
        rowLink={(claim) => ({ to: '/visits/$visitId', params: { visitId: String(claim.visitId) } })}
        empty={
          filtered ? (
            <EmptyState
              icon={<Send size={20} />}
              title="No claims match"
              description="Try a different search, or show every practice."
              action={<Button onClick={clearAll}>Clear search and filters</Button>}
            />
          ) : (
            <EmptyState
              icon={<Send size={20} />}
              title="No claims yet"
              description="Claims are created from a visit’s charge lines."
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
