import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Landmark, Plus } from 'lucide-react'
import { Tag } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { CellSub, DataTable, type Column, type Sort } from '@/components/ui/DataTable'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { RowActionButton, StatusChangeDialog, actionsColumn, activeColumn } from '@/components/ui/RowActions'
import { EmptyState } from '@/components/ui/States'
import { FilterBar, PageContainer, PageHeader } from '@/components/shared/PageLayout'
import { PracticeSelect, usePractices } from '@/features/admin-practices'
import { isApiError, userMessage } from '@/lib/api/api-error'
import { toast } from '@/stores/toast-store'
import { effectiveBooleans, hasOverrides, insuranceLabel } from '../model/rules'
import {
  useDeleteInsurance,
  useInsuranceClasses,
  useInsurances,
  useSetInsuranceActive,
} from '../queries/use-insurances'
import type { Insurance } from '../schemas/insurance'
import { InsuranceDialog } from './InsuranceDialog'

/**
 * Setup → Insurances: the list and the dialog that adds or edits one. Laid
 * out as the updated prototype's list, with what the list endpoint carries:
 * payer (code and name; class and type; practice), payer ID, the effective
 * billing rules, insurance hold (with its bucket) and audit, the Active switch
 * (asks first), Edit and Delete. A practice filter is kept in the URL
 * (`?practice=<id>`).
 *
 * Not in the list endpoint, so not in the list: the payer portal link, the
 * payment SLA and the claim format — they are in the insurance's own record,
 * which the dialog reads.
 *
 * Effective billing rules: each yes/no rule is the insurance's own value, else
 * its class's (PRD V2 §10.3: COALESCE(insurance, class)) — the class defaults
 * from the class list.
 *
 * Every insurance is read (all of the server's pages) and filtered and sorted
 * here: the prototype neither pages nor searches. Sorted by code.
 */
export function InsurancesScreen({ practiceFilter }: { practiceFilter: number | undefined }) {
  const navigate = useNavigate()
  const insurances = useInsurances()
  const setActive = useSetInsuranceActive()
  const remove = useDeleteInsurance()
  const classes = useInsuranceClasses()
  const practices = usePractices()
  /** `undefined`: no dialog. `null`: adding. An insurance: editing it. */
  const [editing, setEditing] = useState<Insurance | null | undefined>(undefined)
  /** The row whose Active switch was flipped, waiting for confirmation. */
  const [statusOf, setStatusOf] = useState<Insurance | null>(null)
  const [deleting, setDeleting] = useState<Insurance | null>(null)
  const [sort, setSort] = useState<Sort>({ key: 'code', direction: 'asc' })

  const practiceName = (id: number) => practices.data?.find((practice) => practice.id === id)?.name
  const classOf = (insurance: Insurance) =>
    classes.data?.find((insuranceClass) => insuranceClass.id === insurance.insuranceClassId)
  const filter = practiceFilter === undefined ? null : String(practiceFilter)
  const setFilter = (value: string | null) =>
    void navigate({
      to: '/setup/insurances',
      search: value === null ? {} : { practice: Number(value) },
      replace: true,
    })

  const rows = (insurances.data ?? [])
    .filter((insurance) => practiceFilter === undefined || insurance.practiceId === practiceFilter)
    .sort((a, b) => (sort.direction === 'asc' ? a.code - b.code : b.code - a.code))

  const confirmDelete = async (insurance: Insurance) => {
    try {
      const message = await remove.mutateAsync(insurance.id)
      toast.success(message ?? `${insuranceLabel(insurance)} deleted`)
    } catch (error) {
      toast.error(
        `${insuranceLabel(insurance)} was not deleted`,
        isApiError(error) ? userMessage(error) : 'Something went wrong. Please try again.',
      )
    }
  }

  const columns: ReadonlyArray<Column<Insurance>> = [
    {
      key: 'code',
      header: 'Payer',
      primary: true,
      sortable: true,
      // Room for "1002 – Empire BlueCross BlueShield" on two lines, not four.
      width: '15rem',
      cell: (insurance) => (
        <span className="block break-words">
          {insuranceLabel(insurance)}
          <CellSub>
            {insurance.insuranceClassName}
            <span aria-hidden="true"> · </span>
            {insurance.insuranceTypeLabel}
          </CellSub>
          {/* Whose payer it is — always, filtered or not, so a row keeps its height. */}
          {practiceName(insurance.practiceId) !== undefined && (
            <CellSub>{practiceName(insurance.practiceId)}</CellSub>
          )}
        </span>
      ),
    },
    {
      key: 'payerId',
      header: 'Payer ID',
      cell: (insurance) =>
        insurance.payerId === '' ? (
          <span className="text-n400">—</span>
        ) : (
          <span className="whitespace-nowrap">{insurance.payerId}</span>
        ),
    },
    {
      key: 'rules',
      header: 'Effective billing rules',
      cell: (insurance) => {
        const insuranceClass = classOf(insurance)
        if (insuranceClass === undefined) return <span className="text-n500">—</span>
        const effective = effectiveBooleans(insuranceClass, insurance.rules)
        return (
          <span className="flex flex-wrap gap-1">
            {effective.authorizationRequired && <Tag>Auth required</Tag>}
            {effective.injuryDateRequired && <Tag>Injury date required</Tag>}
            {effective.applySpecialtyModifiers && <Tag>Specialty modifiers</Tag>}
            {!effective.acceptAssignment && <Tag tone="attention">No assignment</Tag>}
            {hasOverrides(insurance.rules) && <span className="text-micro text-n500">· overrides class</span>}
          </span>
        )
      },
    },
    {
      key: 'hold',
      header: 'Insurance hold',
      cell: (insurance) => (
        <span className="flex flex-col items-start gap-1">
          {insurance.insuranceHold ? (
            <span>
              <Tag tone="attention">Manual release</Tag>
              <CellSub>{insurance.releaseBucketName ?? 'No bucket'}</CellSub>
            </span>
          ) : (
            <span className="text-n500">Automatic</span>
          )}
          {insurance.auditRequired && <Tag tone="attention">Audit required</Tag>}
        </span>
      ),
    },
    activeColumn<Insurance>({
      isActive: (insurance) => insurance.isActive,
      label: (insurance) => insuranceLabel(insurance),
      // Asks first (StatusChangeDialog below).
      onChange: (insurance) => setStatusOf(insurance),
    }),
    actionsColumn<Insurance>((insurance) => (
      <>
        <RowActionButton
          action="edit"
          label={`Edit ${insuranceLabel(insurance)}`}
          onClick={() => setEditing(insurance)}
        />
        <RowActionButton
          action="delete"
          label={`Delete ${insuranceLabel(insurance)}`}
          onClick={() => setDeleting(insurance)}
        />
      </>
    )),
  ]

  const newButton = (
    <Button variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => setEditing(null)}>
      New insurance
    </Button>
  )

  return (
    <PageContainer>
      <PageHeader
        title="Insurances"
        description="Add and manage the payers your practices bill, with their billing rules and payer portal link."
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
        caption="Insurances"
        columns={columns}
        rows={rows}
        getRowId={(insurance) => String(insurance.id)}
        loading={insurances.isPending}
        error={insurances.isError}
        onRetry={() => void insurances.refetch()}
        sort={sort}
        onSortChange={setSort}
        empty={
          filter === null ? (
            <EmptyState
              icon={<Landmark size={20} />}
              title="No insurances yet"
              description="An insurance is a payer as your practice bills it. Each one belongs to an insurance class and inherits its rules."
              action={
                <Button
                  variant="primary"
                  icon={<Plus size={16} aria-hidden="true" />}
                  onClick={() => setEditing(null)}
                >
                  Add an insurance
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<Landmark size={20} />}
              title="No insurances in this practice"
              description="Add one, or show every practice."
              action={<Button onClick={() => setFilter(null)}>Show all practices</Button>}
            />
          )
        }
        footer={<span>{rows.length === 1 ? '1 insurance' : `${rows.length} insurances`}</span>}
      />

      {editing !== undefined && (
        <InsuranceDialog
          key={editing?.id ?? 'new'}
          insurance={editing}
          defaultPracticeId={filter}
          onClose={() => setEditing(undefined)}
        />
      )}
      {statusOf !== null && (
        <StatusChangeDialog
          name={insuranceLabel(statusOf)}
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
        title={`Delete ${deleting === null ? '' : insuranceLabel(deleting)}?`}
        confirmLabel="Delete insurance"
        tone="destructive"
        onConfirm={() => (deleting === null ? undefined : confirmDelete(deleting))}
      />
    </PageContainer>
  )
}
