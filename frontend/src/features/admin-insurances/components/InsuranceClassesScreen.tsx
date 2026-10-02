import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Layers, Plus } from 'lucide-react'
import { StatusDot, Tag } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { CellSub, DataTable, type Column, type Sort } from '@/components/ui/DataTable'
import { RowActionButton, actionsColumn, activeColumn, statusChangeFailed } from '@/components/ui/RowActions'
import { EmptyState } from '@/components/ui/States'
import { FilterBar, PageContainer, PageHeader } from '@/components/shared/PageLayout'
import { PracticeSelect, usePractices } from '@/features/admin-practices'
import { hasOverrides } from '../model/rules'
import { useInsuranceClasses, useInsurances, useUpdateInsuranceClass } from '../queries/use-insurances'
import { toInsuranceClassFormValues, type InsuranceClass } from '../schemas/insurance-class'
import { InsuranceClassDialog } from './InsuranceClassDialog'

/**
 * Setup → Insurance classes: the list and the dialog that adds or edits one.
 * Laid out as the prototype's list — code, class, rule defaults, how many
 * insurances are in the class and how many of them override it, status.
 * There is no practice switcher yet, so every practice's classes are listed,
 * each naming its practice, with a practice filter kept in the URL
 * (`?practice=<id>`), as for referring physicians.
 *
 * Not paged or searched: the prototype does neither, and a practice has a
 * handful of classes. Sorted by code, as the prototype sorts it.
 */
export function InsuranceClassesScreen({ practiceFilter }: { practiceFilter: number | undefined }) {
  const navigate = useNavigate()
  const classes = useInsuranceClasses()
  const update = useUpdateInsuranceClass()
  const insurances = useInsurances()
  const practices = usePractices()
  /** `undefined`: no dialog. `null`: adding. A class: editing it. */
  const [editing, setEditing] = useState<InsuranceClass | null | undefined>(undefined)
  const [sort, setSort] = useState<Sort>({ key: 'code', direction: 'asc' })

  const practiceName = (id: number) => practices.data?.find((practice) => practice.id === id)?.name
  const filter = practiceFilter === undefined ? null : String(practiceFilter)
  const setFilter = (value: string | null) =>
    void navigate({
      to: '/setup/insurance-classes',
      search: value === null ? {} : { practice: Number(value) },
      replace: true,
    })

  const membersOf = (insuranceClass: InsuranceClass) =>
    (insurances.data ?? []).filter((insurance) => insurance.insuranceClassId === insuranceClass.id)

  const rows = (classes.data ?? [])
    .filter((insuranceClass) => practiceFilter === undefined || insuranceClass.practiceId === practiceFilter)
    .sort((a, b) => {
      const order =
        sort.key === 'name'
          ? a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
          : a.code.localeCompare(b.code, undefined, { sensitivity: 'base' })
      return sort.direction === 'asc' ? order : -order
    })

  const columns: ReadonlyArray<Column<InsuranceClass>> = [
    {
      key: 'code',
      header: 'Code',
      sortable: true,
      hideOnMobile: true,
      cell: (insuranceClass) => (
        <span className="text-ink font-medium whitespace-nowrap">{insuranceClass.code}</span>
      ),
    },
    {
      key: 'name',
      header: 'Class',
      primary: true,
      sortable: true,
      // Room for a two-word class name without breaking inside a word.
      width: '12rem',
      cell: (insuranceClass) => (
        <span className="block">
          {insuranceClass.name}
          {/* On a phone, where the code column is hidden, the code rides under the name. */}
          <span className="sm:hidden">
            <CellSub>{insuranceClass.code}</CellSub>
          </span>
          {/* Every practice listed: say whose class it is. Filtered to one, that is already known. */}
          {practiceFilter === undefined && practiceName(insuranceClass.practiceId) !== undefined && (
            <CellSub>{practiceName(insuranceClass.practiceId)}</CellSub>
          )}
        </span>
      ),
    },
    {
      key: 'rules',
      header: 'Rule defaults',
      hideBelow: 'md',
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
      hideOnMobile: true,
      cell: (insuranceClass) => <span className="tabular-nums">{membersOf(insuranceClass).length}</span>,
    },
    {
      key: 'overrides',
      header: 'With overrides',
      hideBelow: 'xl',
      cell: (insuranceClass) => {
        const count = membersOf(insuranceClass).filter((insurance) => hasOverrides(insurance.rules)).length
        return count > 0 ? (
          <StatusDot tone="attention">{count}</StatusDot>
        ) : (
          <span className="text-n500 tabular-nums">0</span>
        )
      },
    },
    activeColumn<InsuranceClass>({
      isActive: (insuranceClass) => insuranceClass.isActive,
      label: (insuranceClass) => insuranceClass.name,
      // The class's own update, with only `is_active` changed.
      onChange: (insuranceClass, isActive) =>
        update.mutate(
          { id: insuranceClass.id, values: { ...toInsuranceClassFormValues(insuranceClass), isActive } },
          { onError: (error) => statusChangeFailed(insuranceClass.name, isActive, error) },
        ),
      pending: (insuranceClass) => update.isPending && update.variables.id === insuranceClass.id,
    }),
    actionsColumn<InsuranceClass>((insuranceClass) => (
      <RowActionButton
        action="edit"
        label={`Edit ${insuranceClass.name}`}
        onClick={() => setEditing(insuranceClass)}
      />
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
        sort={sort}
        onSortChange={setSort}
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
    </PageContainer>
  )
}
