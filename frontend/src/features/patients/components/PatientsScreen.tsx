import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { SlidersHorizontal, UserPlus, Users } from 'lucide-react'
import { toast } from '@/stores/toast-store'
import { Button } from '@/components/ui/Button'
import { CellSub, DataTable, type Column, type Sort } from '@/components/ui/DataTable'
import { SearchInput } from '@/components/ui/Input'
import { Pagination } from '@/components/ui/Pagination'
import { activeColumn } from '@/components/ui/RowActions'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { FilterBar, PageContainer, PageHeader } from '@/components/shared/PageLayout'
import { useInsurances } from '@/features/admin-insurances'
import { PracticeSelect, usePractices } from '@/features/admin-practices'
import { formatIsoDate } from '@/lib/utils/dates'
import { usePatientRecords } from '../data/patient-records-store'
import { listName, type Patient } from '../model/patient'
import {
  DEFAULT_FILTERS,
  activeFilterCount,
  casesOf,
  leadCase,
  matchesSearch,
  primaryInsuranceId,
  type PatientFilters,
} from '../model/roster'
import { toPatientValues } from '../schemas/patient-form'
import { PatientDialog } from './PatientDialog'
import { PatientFiltersDrawer } from './PatientFiltersDrawer'
import { PatientStatusDialog } from './PatientStatusDialog'

/** The prototype pages the roster 12 patients at a time. */
const PAGE_SIZE = 12

interface Row {
  patient: Patient
  cases: number
  insurance: string
}

/**
 * Patients — the roster, as the prototype has it: search by name, Billing ID
 * or EMR ID; filters (primary insurance, status — Active by default); Patient
 * (with its Billing ID), Born, EMR ID, Cases, Primary insurance and the shared
 * Active switch (deactivating or reactivating asks first, as the prototype
 * does); sorted, 12 a page; "New patient". A row opens the patient's chart.
 *
 * As on the other practice-scoped screens, the practice filter is in the URL
 * (`?practice=<id>`). The search text and the other filters stay in the
 * screen: a search can hold a patient's name, and PHI never goes in a URL.
 *
 * Not shown, because what they are built on does not exist yet: the "Open
 * balance" column and filter (billed charges), the location filter and the
 * billing-exception flag (visits).
 *
 * **Frontend only.** There is no backend for patients: they live in this
 * browser tab (`data/patient-records-store.ts`). That is architecture, not
 * product: the screen shows no message about it.
 */
export function PatientsScreen({ practiceFilter }: { practiceFilter: number | undefined }) {
  const navigate = useNavigate()
  const records = usePatientRecords()
  const practices = usePractices()
  const insurances = useInsurances()
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<PatientFilters>(DEFAULT_FILTERS)
  const [filtering, setFiltering] = useState(false)
  const [creating, setCreating] = useState(false)
  const [statusOf, setStatusOf] = useState<Patient | null>(null)
  const [sort, setSort] = useState<Sort>({ key: 'name', direction: 'asc' })
  const [page, setPage] = useState(1)

  const insuranceName = (id: number | undefined) =>
    id === undefined ? '' : (insurances.data?.find((item) => item.id === id)?.name ?? '')
  const practiceInsurances = (insurances.data ?? []).filter(
    (item) => practiceFilter === undefined || item.practiceId === practiceFilter,
  )
  const insuranceNames = [...new Set(practiceInsurances.map((item) => item.name))]

  const setPractice = (value: string | null) => {
    setPage(1)
    void navigate({
      to: '/patients',
      search: value === null ? {} : { practice: Number(value) },
      replace: true,
    })
  }
  const filtered = search.trim() !== '' || activeFilterCount(filters) > 0

  const rows: Row[] = records.patients
    .filter((patient) => practiceFilter === undefined || patient.practiceId === practiceFilter)
    .map((patient) => {
      const own = casesOf(records.cases, patient.id)
      return {
        patient,
        cases: own.length,
        insurance: insuranceName(primaryInsuranceId(leadCase(own), records.coverages)),
      }
    })
    .filter((row) => matchesSearch(row.patient, search))
    .filter((row) => filters.insurance === '' || row.insurance === filters.insurance)
    .filter((row) => filters.status === 'All' || row.patient.isActive === (filters.status === 'Active'))
    .sort((a, b) => {
      const text = (left: string, right: string) =>
        left.localeCompare(right, undefined, { sensitivity: 'base' })
      const order =
        sort.key === 'dob'
          ? a.patient.dob.localeCompare(b.patient.dob)
          : sort.key === 'emrId'
            ? (a.patient.emrId ?? 0) - (b.patient.emrId ?? 0)
            : sort.key === 'cases'
              ? a.cases - b.cases
              : sort.key === 'insurance'
                ? text(a.insurance, b.insurance)
                : text(listName(a.patient), listName(b.patient))
      return sort.direction === 'asc' ? order : -order
    })

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
      sortable: true,
      cell: ({ patient }) => (
        <span className="block [overflow-wrap:anywhere]">
          {patient.lastName}, <span className="text-n600 font-normal">{patient.firstName}</span>
          {patient.billingId !== null && <CellSub>Billing ID {patient.billingId}</CellSub>}
          {/* On a phone, where its column is hidden, the birth date rides under the name. */}
          <span className="sm:hidden">
            <CellSub>Born {formatIsoDate(patient.dob)}</CellSub>
          </span>
        </span>
      ),
    },
    {
      key: 'dob',
      header: 'Born',
      sortable: true,
      hideOnMobile: true,
      cell: ({ patient }) => (
        <span className="whitespace-nowrap tabular-nums">{formatIsoDate(patient.dob)}</span>
      ),
    },
    {
      key: 'emrId',
      header: 'EMR ID',
      sortable: true,
      hideBelow: 'lg',
      cell: ({ patient }) =>
        patient.emrId === null ? (
          <span className="text-n400">—</span>
        ) : (
          <span className="tabular-nums">{patient.emrId}</span>
        ),
    },
    {
      key: 'cases',
      header: 'Cases',
      sortable: true,
      hideBelow: 'xl',
      cell: ({ cases }) => <span className="tabular-nums">{cases}</span>,
    },
    {
      key: 'insurance',
      header: 'Primary insurance',
      sortable: true,
      hideBelow: 'md',
      cell: ({ insurance }) =>
        insurance === '' ? (
          <span className="text-n400">—</span>
        ) : (
          <span className="break-words">{insurance}</span>
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

      {practices.isError ? (
        <ErrorState onRetry={() => void practices.refetch()} />
      ) : (
        <DataTable
          caption="Patients"
          columns={columns}
          rows={pageRows}
          getRowId={({ patient }) => patient.id}
          loading={!records.ready}
          sort={sort}
          onSortChange={(next) => {
            setSort(next)
            setPage(1)
          }}
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
          insuranceNames={insuranceNames}
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
          onSave={(values) => {
            const created = records.createPatient(toPatientValues(values, Number(values.practiceId)))
            toast.success(
              'Patient created',
              'A “Default” case was added. Add the patient’s insurance, then choose it on the case with its diagnoses before the first charge.',
            )
            void navigate({
              to: '/patients/$patientId',
              params: { patientId: created.patientId },
              hash: 'insurance',
            })
          }}
          onClose={() => setCreating(false)}
        />
      )}

      {statusOf !== null && (
        <PatientStatusDialog
          patient={statusOf}
          onConfirm={(isActive) => records.setPatientActive(statusOf.id, isActive)}
          onClose={() => setStatusOf(null)}
        />
      )}
    </PageContainer>
  )
}
