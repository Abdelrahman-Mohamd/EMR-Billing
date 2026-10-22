import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { SlidersHorizontal, UserPlus, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { CellSub, DataTable, type Column } from '@/components/ui/DataTable'
import { SearchInput } from '@/components/ui/Input'
import { Pagination } from '@/components/ui/Pagination'
import { activeColumn } from '@/components/ui/RowActions'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { FilterBar, PageContainer, PageHeader } from '@/components/shared/PageLayout'
import { PracticeSelect, usePractices } from '@/features/admin-practices'
import { formatIsoDate } from '@/lib/utils/dates'
import { genderName, listName, type PatientSummary } from '../model/patient'
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value'
import { DEFAULT_FILTERS, activeFilterCount, type PatientFilters } from '../model/roster'
import { usePatientWrites, usePatients, useSetPatientActive } from '../queries/use-patients'
import { PatientDialog } from './PatientDialog'
import { PatientFiltersDrawer } from './PatientFiltersDrawer'
import { PatientStatusDialog } from './PatientStatusDialog'

/** The prototype pages the roster 12 patients at a time. */
const PAGE_SIZE = 12

interface Row {
  patient: PatientSummary
}

/**
 * Patients — the roster, as the prototype has it: search by name, Billing ID
 * or EMR ID; the status filter (Active by default); Patient (with its Billing
 * ID — the server's id), Born (with gender), EMR ID and the shared Active
 * switch (deactivating or reactivating asks first, as the prototype does);
 * sorted, 12 a page; "New patient". A row opens the patient's chart.
 *
 * As on the other practice-scoped screens, the practice filter is in the URL
 * (`?practice=<id>`). The search text and the other filters stay in the
 * screen: a search can hold a patient's name, and PHI never goes in the app's
 * URL.
 *
 * The search is the server's (`search`, asked once typing pauses — user,
 * 2026-10-20); every patient it answers with (all of its pages) is filtered,
 * sorted and paged here. Not shown, because the
 * patient list does not carry them: the prototype's Cases and Primary
 * insurance columns and insurance filter (a case's coverage), the "Open
 * balance" column and filter (billed charges), the location filter and the
 * billing-exception flag (visits).
 *
 * The server does not return a new patient's id, so creating one stays on the
 * roster, which shows them once the list is read again.
 */
export function PatientsScreen({ practiceFilter }: { practiceFilter: number | undefined }) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  // The server searches (`search`), once typing pauses.
  const patients = usePatients(useDebouncedValue(search.trim()))
  const practices = usePractices()
  const writes = usePatientWrites()
  const setActive = useSetPatientActive()
  const [filters, setFilters] = useState<PatientFilters>(DEFAULT_FILTERS)
  const [filtering, setFiltering] = useState(false)
  const [creating, setCreating] = useState(false)
  const [statusOf, setStatusOf] = useState<PatientSummary | null>(null)
  const [page, setPage] = useState(1)

  const setPractice = (value: string | null) => {
    setPage(1)
    void navigate({
      to: '/patients',
      search: value === null ? {} : { practice: Number(value) },
      replace: true,
    })
  }
  const filtered = search.trim() !== '' || activeFilterCount(filters) > 0

  const rows: Row[] = (patients.data ?? [])
    .filter((patient) => practiceFilter === undefined || patient.practiceId === practiceFilter)
    .map((patient) => ({ patient }))
    .filter((row) => filters.status === 'All' || row.patient.isActive === (filters.status === 'Active'))

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const pageRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const summary =
    rows.length <= PAGE_SIZE
      ? `${rows.length} ${rows.length === 1 ? 'patient' : 'patients'}`
      : `Showing ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, rows.length)} of ${rows.length} patients`

  const clearAll = () => {
    setSearch('')
    setFilters(DEFAULT_FILTERS)
    setPage(1)
  }

  const columns: ReadonlyArray<Column<Row>> = [
    {
      key: 'name',
      header: 'Patient',
      primary: true,
      cell: ({ patient }) => (
        <span className="block break-words">
          {patient.lastName}, <span className="text-n600 font-normal">{patient.firstName}</span>
          <CellSub>Billing ID {patient.billingId}</CellSub>
        </span>
      ),
    },
    {
      key: 'dob',
      header: 'Born',
      cell: ({ patient }) => (
        <span className="block whitespace-nowrap">
          <span className="tabular-nums">{formatIsoDate(patient.dob)}</span>
          {genderName(patient) !== '' && <CellSub>{genderName(patient)}</CellSub>}
        </span>
      ),
    },
    {
      key: 'emrId',
      header: 'EMR ID',
      cell: ({ patient }) =>
        patient.emrId === null ? (
          <span className="text-n400">—</span>
        ) : (
          <span className="tabular-nums">{patient.emrId}</span>
        ),
    },
    activeColumn<Row>({
      isActive: ({ patient }) => patient.isActive,
      label: ({ patient }) => listName(patient),
      // As in the prototype, a change of status asks first.
      onChange: ({ patient }) => setStatusOf(patient),
    }),
  ]

  const newButton = (
    <Button
      variant="primary"
      icon={<UserPlus size={16} aria-hidden="true" />}
      onClick={() => setCreating(true)}
    >
      New patient
    </Button>
  )
  const filterCount = activeFilterCount(filters)

  return (
    <PageContainer>
      <PageHeader title="Patients" actions={newButton} />

      <FilterBar
        search={
          <SearchInput
            aria-label="Search by name, Billing ID or EMR ID"
            placeholder="Search by name, Billing ID or EMR ID…"
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
        <Button
          icon={<SlidersHorizontal size={16} aria-hidden="true" />}
          // Spelled out: the count alone would be read as "Filters1".
          aria-label={filterCount > 0 ? `Filters, ${filterCount} on` : 'Filters'}
          onClick={() => setFiltering(true)}
        >
          Filters
          {filterCount > 0 && (
            <span
              aria-hidden="true"
              className="bg-brand-wash text-brand-deep text-micro ml-0.5 rounded-full px-1.5 tabular-nums"
            >
              {filterCount}
            </span>
          )}
        </Button>
      </FilterBar>

      {practices.isError || patients.isError ? (
        <ErrorState
          onRetry={() => {
            if (practices.isError) void practices.refetch()
            if (patients.isError) void patients.refetch()
          }}
        />
      ) : (
        <DataTable
          caption="Patients"
          columns={columns}
          rows={pageRows}
          getRowId={({ patient }) => patient.id}
          loading={patients.isPending}
          // A row opens the patient's chart; "View chart" at its end says so.
          openHint="View chart"
          rowLink={({ patient }) => ({
            to: '/patients/$patientId',
            params: { patientId: patient.id },
          })}
          empty={
            filtered ? (
              <EmptyState
                title="No patients match"
                description="Try a different name or clear the filters."
                action={<Button onClick={clearAll}>Clear search and filters</Button>}
              />
            ) : (
              <EmptyState
                icon={<Users size={20} />}
                title="No patients yet"
                description="Patients arrive from the EMR with their first finalized note, or can be added here."
              />
            )
          }
          footer={
            rows.length > 0 ? (
              <Pagination page={currentPage} pageCount={pageCount} onPageChange={setPage} summary={summary} />
            ) : undefined
          }
        />
      )}

      {filtering && (
        <PatientFiltersDrawer
          filters={filters}
          onApply={(next) => {
            setFilters(next)
            setPage(1)
          }}
          onClose={() => setFiltering(false)}
        />
      )}

      {creating && (
        <PatientDialog
          patient={null}
          defaultPracticeId={practiceFilter === undefined ? null : String(practiceFilter)}
          onSave={writes.create}
          onClose={() => setCreating(false)}
        />
      )}

      {statusOf !== null && (
        <PatientStatusDialog
          patient={statusOf}
          onConfirm={(isActive) => setActive.mutateAsync({ id: statusOf.id, isActive })}
          onClose={() => setStatusOf(null)}
        />
      )}
    </PageContainer>
  )
}
