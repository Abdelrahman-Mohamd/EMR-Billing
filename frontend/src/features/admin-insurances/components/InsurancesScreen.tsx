import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ExternalLink, Landmark, Plus } from 'lucide-react'
import { Tag } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { CellSub, DataTable, type Column, type Sort } from '@/components/ui/DataTable'
import { RowActionButton, actionsColumn, activeColumn, statusChangeFailed } from '@/components/ui/RowActions'
import { EmptyState } from '@/components/ui/States'
import { FilterBar, PageContainer, PageHeader } from '@/components/shared/PageLayout'
import { PracticeSelect, usePractices } from '@/features/admin-practices'
import { useReleaseBuckets } from '@/features/admin-release-buckets'
import { effectiveRules, hasOverrides, insuranceLabel } from '../model/rules'
import { useInsuranceClasses, useInsurances, useUpdateInsurance } from '../queries/use-insurances'
import { toInsuranceFormValues, type Insurance } from '../schemas/insurance'
import { InsuranceDialog } from './InsuranceDialog'

/**
 * Setup → Insurances: the list and the dialog that adds or edits one. Laid
 * out as the updated prototype's list — payer (code and name, class and type),
 * payer ID with the portal link, the effective billing rules, insurance hold
 * and audit, SLA, status — with a practice filter kept in the URL
 * (`?practice=<id>`), as for referring physicians. Unfiltered, each payer's
 * practice is named under it; there is no room for a column of its own.
 *
 * Not paged or searched: the prototype does neither. Sorted by code, as the
 * prototype sorts it. Status is changed in the dialog, not from the row.
 */
export function InsurancesScreen({ practiceFilter }: { practiceFilter: number | undefined }) {
  const navigate = useNavigate()
  const insurances = useInsurances()
  const update = useUpdateInsurance()
  const classes = useInsuranceClasses()
  const buckets = useReleaseBuckets()
  const practices = usePractices()
  /** `undefined`: no dialog. `null`: adding. An insurance: editing it. */
  const [editing, setEditing] = useState<Insurance | null | undefined>(undefined)
  const [sort, setSort] = useState<Sort>({ key: 'code', direction: 'asc' })

  const practiceName = (id: number) => practices.data?.find((practice) => practice.id === id)?.name
  const classOf = (insurance: Insurance) =>
    classes.data?.find((insuranceClass) => insuranceClass.id === insurance.insuranceClassId)
  const bucketName = (id: number | null) => buckets.data?.find((bucket) => bucket.id === id)?.name
  const filter = practiceFilter === undefined ? null : String(practiceFilter)
  const setFilter = (value: string | null) =>
    void navigate({
      to: '/setup/insurances',
      search: value === null ? {} : { practice: Number(value) },
      replace: true,
    })

  const rows = (insurances.data ?? [])
    .filter((insurance) => practiceFilter === undefined || insurance.practiceId === practiceFilter)
    .sort((a, b) => {
      const order = sort.key === 'sla' ? a.slaDays - b.slaDays : a.code - b.code
      return sort.direction === 'asc' ? order : -order
    })

  const columns: ReadonlyArray<Column<Insurance>> = [
    {
      key: 'code',
      header: 'Payer',
      primary: true,
      sortable: true,
      // Room for "1002 – Empire BlueCross BlueShield" on two lines, not four.
      width: '15rem',
      cell: (insurance) => {
        const insuranceClass = classOf(insurance)
        return (
          <span className="block [overflow-wrap:anywhere]">
            {insuranceLabel(insurance)}
            <CellSub>
              {insuranceClass?.name ?? 'No class'}
              <span aria-hidden="true"> · </span>
              {insurance.insuranceType}
            </CellSub>
            {/* Every practice listed: say whose payer it is. Filtered to one, that is already known. */}
            {practiceFilter === undefined && practiceName(insurance.practiceId) !== undefined && (
              <CellSub>{practiceName(insurance.practiceId)}</CellSub>
            )}
            {/* Until the hold column appears, audit is marked under the payer. */}
            {insurance.auditRequired && (
              <span className="mt-1 flex lg:hidden">
                <Tag tone="attention">Audit required</Tag>
              </span>
            )}
          </span>
        )
      },
    },
    {
      key: 'payerId',
      header: 'Payer ID',
      hideBelow: 'md',
      interactive: true,
      cell: (insurance) => (
        <span className="block">
          <span className="whitespace-nowrap">{insurance.payerId}</span>
          {insurance.portalUrl !== '' && (
            <CellSub>
              <a
                href={insurance.portalUrl}
                target="_blank"
                rel="noopener noreferrer"
                // The after: box widens the hit area to a comfortable touch target.
                className="text-brand-deep hover:text-ink relative inline-flex items-center gap-1 whitespace-nowrap no-underline after:absolute after:-inset-x-1 after:-inset-y-2.5 after:content-['']"
              >
                Payer portal
                <ExternalLink size={12} aria-hidden="true" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </CellSub>
          )}
        </span>
      ),
    },
    {
      key: 'rules',
      header: 'Effective billing rules',
      hideBelow: 'xl',
      cell: (insurance) => {
        const insuranceClass = classOf(insurance)
        if (insuranceClass === undefined) return <span className="text-n500">—</span>
        const effective = Object.fromEntries(
          effectiveRules(insuranceClass, insurance.rules).map((rule) => [rule.key, rule.value]),
        )
        return (
          <span className="flex flex-wrap gap-1">
            {effective.authorizationRequired === 'Yes' && <Tag>Auth required</Tag>}
            {effective.injuryDateRequired === 'Yes' && <Tag>Injury date required</Tag>}
            {effective.applySpecialtyModifiers === 'Yes' && <Tag>Specialty modifiers</Tag>}
            {insurance.claimFormat === 'CMS1500' && <Tag>Paper CMS-1500</Tag>}
            {hasOverrides(insurance.rules) && <span className="text-micro text-n500">· overrides class</span>}
          </span>
        )
      },
    },
    {
      key: 'hold',
      header: 'Insurance hold',
      hideBelow: 'lg',
      cell: (insurance) => (
        <span className="flex flex-col items-start gap-1">
          {insurance.insuranceHold ? (
            <span>
              <Tag tone="attention">Manual release</Tag>
              <CellSub>{bucketName(insurance.releaseBucketId) ?? 'No bucket'}</CellSub>
            </span>
          ) : (
            <span className="text-n500">Automatic</span>
          )}
          {insurance.auditRequired && <Tag tone="attention">Audit required</Tag>}
        </span>
      ),
    },
    {
      key: 'sla',
      header: 'SLA',
      sortable: true,
      hideBelow: 'lg',
      cell: (insurance) => <span className="whitespace-nowrap tabular-nums">{insurance.slaDays} days</span>,
    },
    activeColumn<Insurance>({
      isActive: (insurance) => insurance.isActive,
      label: (insurance) => insuranceLabel(insurance),
      // The insurance's own update, with only `is_active` changed.
      onChange: (insurance, isActive) =>
        update.mutate(
          { id: insurance.id, values: { ...toInsuranceFormValues(insurance), isActive } },
          { onError: (error) => statusChangeFailed(insuranceLabel(insurance), isActive, error) },
        ),
      pending: (insurance) => update.isPending && update.variables.id === insurance.id,
    }),
    actionsColumn<Insurance>((insurance) => (
      <RowActionButton
        action="edit"
        label={`Edit ${insuranceLabel(insurance)}`}
        onClick={() => setEditing(insurance)}
      />
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
    </PageContainer>
  )
}
