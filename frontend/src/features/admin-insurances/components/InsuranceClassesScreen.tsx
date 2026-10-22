import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Layers, Plus } from 'lucide-react'
import { Tag } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { RowActionButton, actionsColumn, StatusChangeDialog, activeColumn } from '@/components/ui/RowActions'
import { EmptyState } from '@/components/ui/States'
import { FilterBar, PageContainer, PageHeader } from '@/components/shared/PageLayout'
import { isApiError, userMessage } from '@/lib/api/api-error'
import { toast } from '@/stores/toast-store'
import { PracticeSelect, usePractices } from '@/features/admin-practices'
import {
  useDeleteInsuranceClass,
  useInsuranceClasses,
  useSetInsuranceClassActive,
} from '../queries/use-insurances'
import type { InsuranceClass } from '../schemas/insurance-class'
import { InsuranceClassDialog } from './InsuranceClassDialog'

/**
 * Setup → Insurance classes: the list and the dialog that adds or edits one.
 * Laid out as the prototype's list — code, class, rule defaults, how many
 * insurances are in the class, status — with what the backend sends and
 * nothing else (the prototype's "With overrides" count is not in it).
 * There is no practice switcher yet, so every practice's classes are listed,
 * each with its practice in its own column (as on Release buckets), with a
 * practice filter kept in the URL (`?practice=<id>`).
 *
 * Every class is read (all of the server's pages) and filtered and sorted
 * here: the prototype neither pages nor searches, and a practice has a
 * handful of classes. Sorted by code, as the prototype sorts it.
 *
 * Insurances: the count the class carries (`insurances_count`). Delete asks
 * first; the server decides whether a class in use can go.
 */
export function InsuranceClassesScreen({ practiceFilter }: { practiceFilter: number | undefined }) {
  const navigate = useNavigate()
  const classes = useInsuranceClasses()
  const setActive = useSetInsuranceClassActive()
  const remove = useDeleteInsuranceClass()
  const practices = usePractices()
  /** `undefined`: no dialog. `null`: adding. A class: editing it. */
  const [editing, setEditing] = useState<InsuranceClass | null | undefined>(undefined)
  /** The row whose Active switch was flipped, waiting for confirmation. */
  const [statusOf, setStatusOf] = useState<InsuranceClass | null>(null)
  const [deleting, setDeleting] = useState<InsuranceClass | null>(null)

  const practiceName = (id: number) => practices.data?.find((practice) => practice.id === id)?.name
  const filter = practiceFilter === undefined ? null : String(practiceFilter)
  const setFilter = (value: string | null) =>
    void navigate({
      to: '/setup/insurance-classes',
      search: value === null ? {} : { practice: Number(value) },
      replace: true,
    })

  const rows = (classes.data ?? []).filter(
    (insuranceClass) => practiceFilter === undefined || insuranceClass.practiceId === practiceFilter,
  )

  const columns: ReadonlyArray<Column<InsuranceClass>> = [
    {
      key: 'code',
      header: 'Code',
      cell: (insuranceClass) => (
        <span className="text-ink font-medium whitespace-nowrap">{insuranceClass.code}</span>
      ),
    },
    {
      key: 'name',
      header: 'Class',
      primary: true,
      // Room for a two-word class name without breaking inside a word.
      width: '12rem',
      cell: (insuranceClass) => <span className="block">{insuranceClass.name}</span>,
    },
    {
      // Always shown, filtered or not, so the rows keep their height when the
      // practice filter changes (as on Release buckets).
      key: 'practice',
      header: 'Practice',
      cell: (insuranceClass) => (
        <span className="break-words">{practiceName(insuranceClass.practiceId) ?? '—'}</span>
      ),
    },
    {
      key: 'rules',
      header: 'Rule defaults',
      cell: (insuranceClass) => (
        <span className="flex flex-wrap gap-1">
          {insuranceClass.authorizationRequired && <Tag>Auth required</Tag>}
          {insuranceClass.injuryDateRequired && <Tag>Injury date required</Tag>}
          {insuranceClass.applySpecialtyModifiers && <Tag>Specialty modifiers</Tag>}
          {!insuranceClass.acceptAssignment && <Tag tone="attention">No assignment</Tag>}
          <Tag>{insuranceClass.icdVersion}</Tag>
        </span>
      ),
    },
    {
      key: 'insurances',
      header: 'Insurances',
      align: 'right',
      cell: (insuranceClass) => <span className="tabular-nums">{insuranceClass.insurancesCount}</span>,
    },
    activeColumn<InsuranceClass>({
      isActive: (insuranceClass) => insuranceClass.isActive,
      label: (insuranceClass) => insuranceClass.name,
      // Asks first (StatusChangeDialog below).
      onChange: (insuranceClass) => setStatusOf(insuranceClass),
    }),
    actionsColumn<InsuranceClass>((insuranceClass) => (
      <>
        <RowActionButton
          action="edit"
          label={`Edit ${insuranceClass.name}`}
          onClick={() => setEditing(insuranceClass)}
        />
        <RowActionButton
          action="delete"
          label={`Delete ${insuranceClass.name}`}
          onClick={() => setDeleting(insuranceClass)}
        />
      </>
    )),
  ]

  const newButton = (
    <Button variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => setEditing(null)}>
      New class
    </Button>
  )

  return (
    <PageContainer>
      <PageHeader
        title="Insurance classes"
        description="Group your insurances and set the billing-rule defaults they inherit."
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
        caption="Insurance classes"
        columns={columns}
        rows={rows}
        getRowId={(insuranceClass) => String(insuranceClass.id)}
        loading={classes.isPending}
        error={classes.isError}
        onRetry={() => void classes.refetch()}
        empty={
          filter === null ? (
            <EmptyState
              icon={<Layers size={20} />}
              title="No insurance classes yet"
              description="Create a class before adding insurances — every insurance belongs to one."
              action={
                <Button
                  variant="primary"
                  icon={<Plus size={16} aria-hidden="true" />}
                  onClick={() => setEditing(null)}
                >
                  Add a class
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<Layers size={20} />}
              title="No classes in this practice"
              description="Add one, or show every practice."
              action={<Button onClick={() => setFilter(null)}>Show all practices</Button>}
            />
          )
        }
        footer={<span>{rows.length === 1 ? '1 class' : `${rows.length} classes`}</span>}
      />

      {editing !== undefined && (
        <InsuranceClassDialog
          key={editing?.id ?? 'new'}
          insuranceClass={editing}
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
        // What deleting does to its insurances is the server's to decide; only their number is stated.
        {...(deleting !== null && deleting.insurancesCount > 0
          ? {
              description: `${deleting.insurancesCount === 1 ? '1 insurance is' : `${deleting.insurancesCount} insurances are`} in this class.`,
            }
          : {})}
        confirmLabel="Delete class"
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
