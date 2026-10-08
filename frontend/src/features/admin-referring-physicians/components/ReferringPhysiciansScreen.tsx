import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Plus, UserRound } from 'lucide-react'
import { StatusDot, Tag } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { CellSub, DataTable, type Column, type Sort } from '@/components/ui/DataTable'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { RowActionButton, StatusChangeDialog, actionsColumn, activeColumn } from '@/components/ui/RowActions'
import { EmptyState } from '@/components/ui/States'
import { FilterBar, PageContainer, PageHeader } from '@/components/shared/PageLayout'
import { PracticeSelect, usePractices } from '@/features/admin-practices'
import { isApiError, userMessage } from '@/lib/api/api-error'
import { isValidNpi } from '@/lib/validation/npi'
import { toast } from '@/stores/toast-store'
import {
  useDeleteReferringPhysician,
  useReferringPhysicians,
  useSetReferringPhysicianActive,
} from '../queries/use-referring-physicians'
import { showPhone, type ReferringPhysician } from '../schemas/referring-physician'
import { ReferringPhysicianDialog } from './ReferringPhysicianDialog'

/**
 * Admin → Referring physicians: the directory, and the dialog that adds or
 * edits one. Laid out as the prototype's list — physician, type, NPI (marked
 * when invalid), phone · fax — with the backend's code, practice and Active
 * switch (asks first), and Edit and Delete. The prototype's Cases count is not
 * in the contract, so it is left out.
 *
 * The prototype shows only the working practice's physicians (its practice
 * switcher). There is no switcher here yet, so the list shows every practice's
 * physicians with a practice filter, kept in the URL (`?practice=<id>`).
 *
 * Every physician is read (all of the server's pages) and filtered and sorted
 * here, by name, as the prototype sorts it.
 */
export function ReferringPhysiciansScreen({ practiceFilter }: { practiceFilter: number | undefined }) {
  const navigate = useNavigate()
  const physicians = useReferringPhysicians()
  const practices = usePractices()
  /** `undefined`: no dialog. `null`: adding. A physician: editing them. */
  const [editing, setEditing] = useState<ReferringPhysician | null | undefined>(undefined)
  /** The row whose Active switch was flipped, waiting for confirmation. */
  const [statusOf, setStatusOf] = useState<ReferringPhysician | null>(null)
  const [deleting, setDeleting] = useState<ReferringPhysician | null>(null)
  const setActive = useSetReferringPhysicianActive()
  const remove = useDeleteReferringPhysician()
  const [sort, setSort] = useState<Sort>({ key: 'name', direction: 'asc' })

  const practiceName = (id: number) => practices.data?.find((practice) => practice.id === id)?.name
  const filter = practiceFilter === undefined ? null : String(practiceFilter)
  const setFilter = (value: string | null) =>
    void navigate({
      to: '/setup/referring-physicians',
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
      cell: (physician) => <span className="block break-words">{physician.name}</span>,
    },
    {
      key: 'code',
      header: 'Code',
      cell: (physician) => (
        <span className="text-ink font-medium whitespace-nowrap tabular-nums">{physician.code}</span>
      ),
    },
    {
      key: 'type',
      header: 'Type (Box 17)',
      cell: (physician) => (
        <Tag tone={physician.type === 'DQ' ? 'attention' : 'brand'} className="whitespace-nowrap">
          {physician.typeLabel === '' ? physician.type : `${physician.type} · ${physician.typeLabel}`}
        </Tag>
      ),
    },
    {
      key: 'npi',
      header: 'NPI',
      // From 1024px; until then an invalid NPI is marked under the name.
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
      cell: (physician) => <span className="break-words">{practiceName(physician.practiceId) ?? '—'}</span>,
    },
    {
      key: 'contact',
      header: 'Phone · fax',
      cell: (physician) =>
        physician.phone === '' && physician.fax === '' ? (
          <span className="text-n400">—</span>
        ) : (
          <span className="block whitespace-nowrap tabular-nums">
            {physician.phone === '' ? '—' : showPhone(physician.phone)}
            {physician.fax !== '' && <CellSub>Fax {showPhone(physician.fax)}</CellSub>}
          </span>
        ),
    },
    activeColumn<ReferringPhysician>({
      isActive: (physician) => physician.isActive,
      label: (physician) => physician.name,
      // Asks first (StatusChangeDialog below).
      onChange: (physician) => setStatusOf(physician),
    }),
    actionsColumn<ReferringPhysician>((physician) => (
      <>
        <RowActionButton
          action="edit"
          label={`Edit ${physician.name}`}
          onClick={() => setEditing(physician)}
        />
        <RowActionButton
          action="delete"
          label={`Delete ${physician.name}`}
          onClick={() => setDeleting(physician)}
        />
      </>
    )),
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
      {statusOf !== null && (
        <StatusChangeDialog
          name={statusOf.name}
          isActive={statusOf.isActive}
          onConfirm={() => setActive.mutateAsync({ id: statusOf.id, isActive: !statusOf.isActive })}
          onClose={() => setStatusOf(null)}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title={`Delete ${deleting?.name ?? ''}?`}
        confirmLabel="Delete physician"
        tone="destructive"
        onConfirm={async () => {
          if (deleting === null) return
          try {
            const message = await remove.mutateAsync(deleting.id)
            toast.success(message ?? `${deleting.name} deleted`)
          } catch (error) {
            toast.error(
              `${deleting.name} was not deleted`,
              isApiError(error) ? userMessage(error) : 'Something went wrong. Please try again.',
            )
          }
        }}
      />
    </PageContainer>
  )
}
