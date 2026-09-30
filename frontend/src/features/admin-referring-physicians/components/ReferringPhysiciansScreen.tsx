import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Pencil, Plus, UserRound } from 'lucide-react'
import { StatusDot, Tag } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { CellSub, DataTable, type Column, type Sort } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/States'
import { FilterBar, PageContainer, PageHeader } from '@/components/shared/PageLayout'
import { PracticeSelect, usePractices } from '@/features/admin-practices'
import { isValidNpi } from '../model/npi'
import { physicianTypeLabel } from '../model/physician-type'
import { useReferringPhysicians } from '../queries/use-referring-physicians'
import type { ReferringPhysician } from '../schemas/referring-physician'
import { ReferringPhysicianDialog } from './ReferringPhysicianDialog'

/**
 * Admin → Referring physicians: the directory, and the dialog that adds or
 * edits one. Laid out as the prototype's list — physician, type, NPI (marked
 * when invalid) — with the payload's code and practice shown, and the
 * prototype's phone · fax and Cases columns left out (not in the payload).
 *
 * The prototype shows only the working practice's physicians (its practice
 * switcher). There is no switcher here yet, so the list shows every practice's
 * physicians with a practice filter, kept in the URL (`?practice=<id>`).
 *
 * The list is not paged: no API defines paging, and a directory per practice
 * is a manageable size. It is sorted here, by name, as the prototype sorts it.
 */
export function ReferringPhysiciansScreen({ practiceFilter }: { practiceFilter: number | undefined }) {
  const navigate = useNavigate()
  const physicians = useReferringPhysicians()
  const practices = usePractices()
  /** `undefined`: no dialog. `null`: adding. A physician: editing them. */
  const [editing, setEditing] = useState<ReferringPhysician | null | undefined>(undefined)
  const [sort, setSort] = useState<Sort>({ key: 'name', direction: 'asc' })

  const practiceName = (id: number) => practices.data?.find((practice) => practice.id === id)?.name
  const filter = practiceFilter === undefined ? null : String(practiceFilter)
  const setFilter = (value: string | null) =>
    void navigate({
      to: '/admin/referring-physicians',
      search: value === null ? {} : { practice: Number(value) },
      replace: true,
    })

  const rows = (physicians.data ?? [])
    .filter((physician) => practiceFilter === undefined || physician.practiceId === practiceFilter)
    .sort((a, b) => {
      const order = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      return sort.direction === 'asc' ? order : -order
    })

  const columns: ReadonlyArray<Column<ReferringPhysician>> = [
    {
      key: 'name',
      header: 'Physician',
      primary: true,
      sortable: true,
      cell: (physician) => (
        <span className="block [overflow-wrap:anywhere]">
          {physician.name}
          {/* On a phone, where their columns are hidden, the code and an invalid-NPI mark ride under the name. */}
          {/* Under the name while their own columns are hidden: the code and
              practice on a phone, the invalid-NPI mark until the NPI column
              appears. */}
          <span className="sm:hidden">
            <CellSub>
              {physician.code}
              {practiceName(physician.practiceId) !== undefined && (
                <>
                  <span aria-hidden="true"> · </span>
                  {practiceName(physician.practiceId)}
                </>
              )}
            </CellSub>
          </span>
          {!isValidNpi(physician.npi) && (
            <span className="lg:hidden">
              <StatusDot tone="critical" className="mt-0.5 flex font-normal">
                Invalid NPI
              </StatusDot>
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'code',
      header: 'Code',
      hideOnMobile: true,
      cell: (physician) => (
        <span className="text-ink font-medium whitespace-nowrap tabular-nums">{physician.code}</span>
      ),
    },
    {
      key: 'type',
      header: 'Type (Box 17)',
      cell: (physician) => (
        <Tag tone={physician.type === 'DQ' ? 'attention' : 'brand'} className="whitespace-nowrap">
          {physicianTypeLabel(physician.type)}
        </Tag>
      ),
    },
    {
      key: 'npi',
      header: 'NPI',
      // From 1024px; until then an invalid NPI is marked under the name.
      hideBelow: 'lg',
      cell: (physician) =>
        isValidNpi(physician.npi) ? (
          <span className="whitespace-nowrap tabular-nums">{physician.npi}</span>
        ) : (
          <span className="block">
            <span className="whitespace-nowrap tabular-nums">
              {physician.npi === '' ? 'Missing' : physician.npi}
            </span>
            <StatusDot tone="critical" className="mt-0.5 flex">
              Invalid NPI
            </StatusDot>
          </span>
        ),
    },
    {
      key: 'practice',
      header: 'Practice',
      hideOnMobile: true,
      cell: (physician) => (
        <span className="[overflow-wrap:anywhere]">{practiceName(physician.practiceId) ?? '—'}</span>
      ),
    },
    {
      key: 'edit',
      header: <span className="sr-only">Edit</span>,
      align: 'right',
      width: '3rem',
      hideOnMobile: true,
      // The row is the edit button (rowAction); the pencil only says so.
      cell: () => <Pencil size={16} aria-hidden="true" className="text-n400 ml-auto" />,
    },
  ]

  const newButton = (
    <Button variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => setEditing(null)}>
      New physician
    </Button>
  )

  return (
    <PageContainer>
      <PageHeader
        title="Referring physicians"
        description="Add and manage the referring and supervising physicians your practices bill with."
        actions={newButton}
      />

      <FilterBar {...(filter === null ? {} : { onReset: () => setFilter(null) })}>
        <PracticeSelect
          aria-label="Filter by practice"
          value={filter}
          onChange={setFilter}
          placeholder="All practices"
          clearable
          className="w-full sm:w-64"
        />
      </FilterBar>

      <DataTable
        caption="Referring physicians"
        columns={columns}
        rows={rows}
        getRowId={(physician) => String(physician.id)}
        loading={physicians.isPending}
        error={physicians.isError}
        onRetry={() => void physicians.refetch()}
        sort={sort}
        onSortChange={setSort}
        rowAction={{ label: (physician) => `Edit ${physician.name}`, onAction: setEditing }}
        empty={
          filter === null ? (
            <EmptyState
              icon={<UserRound size={20} />}
              title="No referring physicians yet"
              description="Add the physicians whose referrals your practices bill."
              action={
                <Button
                  variant="primary"
                  icon={<Plus size={16} aria-hidden="true" />}
                  onClick={() => setEditing(null)}
                >
                  Add a physician
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<UserRound size={20} />}
              title="No physicians in this practice"
              description="Add one, or show every practice."
              action={<Button onClick={() => setFilter(null)}>Show all practices</Button>}
            />
          )
        }
        footer={<span>{rows.length === 1 ? '1 physician' : `${rows.length} physicians`}</span>}
      />

      {editing !== undefined && (
        <ReferringPhysicianDialog
          key={editing?.id ?? 'new'}
          physician={editing}
          defaultPracticeId={filter}
          onClose={() => setEditing(undefined)}
        />
      )}
    </PageContainer>
  )
}
