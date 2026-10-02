import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Plus, Stethoscope } from 'lucide-react'
import { isValidNpi } from '@/lib/validation/npi'
import { StatusDot, Tag } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { CellSub, DataTable, type Column, type Sort } from '@/components/ui/DataTable'
import { RowActionButton, actionsColumn, activeColumn, statusChangeFailed } from '@/components/ui/RowActions'
import { EmptyState } from '@/components/ui/States'
import { FilterBar, PageContainer, PageHeader } from '@/components/shared/PageLayout'
import { useInsurances } from '@/features/admin-insurances'
import { PracticeSelect, usePractices } from '@/features/admin-practices'
import { todayIso } from '@/lib/utils/dates'
import { holdRunning, holdScope, holdWindow } from '../model/claim-hold'
import { providerName, providerTypeMeaning } from '../model/provider-options'
import { useProviders, useUpdateProvider } from '../queries/use-providers'
import { toProviderFormValues, type Provider } from '../schemas/provider'
import { ProviderDialog } from './ProviderDialog'

/**
 * Setup → Providers: the list and the dialog that adds or edits one. Laid out
 * as the updated prototype's list — Provider ID, provider (name and
 * specialty), NPI (marked when missing or invalid), taxonomy · license, claim
 * hold (window, reason and scope; highlighted while it runs), provider type
 * (with what it means) and status — with a practice filter kept in the URL
 * (`?practice=<id>`), as on the other Setup screens. Unfiltered, each
 * provider's practice is named under them.
 *
 * Not paged or searched: the prototype does neither. Sorted by Provider ID, as
 * the prototype sorts it; also by name (last name) and by provider type.
 * Status changes in the dialog, not from the row.
 */
export function ProvidersScreen({ practiceFilter }: { practiceFilter: number | undefined }) {
  const navigate = useNavigate()
  const providers = useProviders()
  const update = useUpdateProvider()
  const practices = usePractices()
  const insurances = useInsurances()
  /** `undefined`: no dialog. `null`: adding. A provider: editing them. */
  const [editing, setEditing] = useState<Provider | null | undefined>(undefined)
  const [sort, setSort] = useState<Sort>({ key: 'code', direction: 'asc' })
  const today = todayIso()

  const practiceOf = (provider: Provider) =>
    practices.data?.find((practice) => practice.id === provider.practiceId)
  const filter = practiceFilter === undefined ? null : String(practiceFilter)
  const setFilter = (value: string | null) =>
    void navigate({
      to: '/setup/providers',
      search: value === null ? {} : { practice: Number(value) },
      replace: true,
    })

  const scopeOf = (provider: Provider) => {
    const locations = practiceOf(provider)?.locations ?? []
    return holdScope(
      provider.claimHold.locationIds.map(
        (id) => locations.find((location) => location.id === id)?.name ?? `Location ${id}`,
      ),
      provider.claimHold.insuranceIds.map(
        (id) => insurances.data?.find((insurance) => insurance.id === id)?.name ?? `Insurance ${id}`,
      ),
    )
  }

  const compare = (a: Provider, b: Provider) => {
    const text = (left: string, right: string) =>
      left.localeCompare(right, undefined, { sensitivity: 'base', numeric: true })
    if (sort.key === 'name') return text(a.lastName, b.lastName) || text(a.firstName, b.firstName)
    if (sort.key === 'providerType') return text(a.providerType, b.providerType)
    return text(a.code, b.code)
  }
  const rows = (providers.data ?? [])
    .filter((provider) => practiceFilter === undefined || provider.practiceId === practiceFilter)
    .sort((a, b) => (sort.direction === 'asc' ? compare(a, b) : -compare(a, b)))

  const typeTag = (provider: Provider) => {
    const meaning = providerTypeMeaning(provider.providerType)
    if (meaning === undefined) return <span className="text-n500">Not set</span>
    return (
      <span className="block">
        <Tag tone={provider.providerType === 'Rendering' ? 'attention' : 'inert'}>
          {provider.providerType}
        </Tag>
        <CellSub>{meaning}</CellSub>
      </span>
    )
  }
  const holdCell = (provider: Provider) =>
    provider.claimHold.until === null ? (
      <span className="text-n500">None</span>
    ) : (
      <span className="block">
        <StatusDot
          tone={holdRunning(provider.claimHold, today) ? 'attention' : 'inert'}
          className="whitespace-normal"
        >
          {holdWindow(provider.claimHold)}
        </StatusDot>
        <CellSub>
          {provider.claimHold.reason}
          <span aria-hidden="true"> · </span>
          {scopeOf(provider)}
        </CellSub>
      </span>
    )

  const columns: ReadonlyArray<Column<Provider>> = [
    {
      key: 'code',
      header: 'Provider ID',
      sortable: true,
      hideOnMobile: true,
      cell: (provider) => <span className="text-ink font-medium whitespace-nowrap">{provider.code}</span>,
    },
    {
      key: 'name',
      header: 'Provider',
      primary: true,
      sortable: true,
      cell: (provider) => (
        // From 1280px, room for "Aisha Rahman, PT, DPT" on one line beside the hold and type columns.
        <span className="block [overflow-wrap:anywhere] xl:min-w-44">
          {providerName(provider) || '(unnamed)'}
          <CellSub>{provider.specialty || '—'}</CellSub>
          {practiceFilter === undefined && practiceOf(provider) !== undefined && (
            <CellSub>{practiceOf(provider)?.name}</CellSub>
          )}
          {/* On a phone, where its column is hidden, the Provider ID rides under the name. */}
          <span className="sm:hidden">
            <CellSub>{provider.code}</CellSub>
          </span>
          {/* Until the type column appears, the type and what it means ride under the name. */}
          {providerTypeMeaning(provider.providerType) !== undefined && (
            <span className="xl:hidden">
              <CellSub>
                {provider.providerType}
                <span aria-hidden="true"> · </span>
                {providerTypeMeaning(provider.providerType)}
              </CellSub>
            </span>
          )}
          {/* Until the NPI column appears, a missing or invalid NPI is marked here. */}
          {!isValidNpi(provider.npi) && (
            <span className="md:hidden">
              <StatusDot tone="critical" className="mt-0.5 flex font-normal whitespace-normal">
                {provider.npi === '' ? 'NPI missing' : 'Invalid NPI'}
              </StatusDot>
            </span>
          )}
          {/* Until the hold column appears, a running hold is marked here. */}
          {holdRunning(provider.claimHold, today) && (
            <span className="xl:hidden">
              <StatusDot tone="attention" className="mt-0.5 flex font-normal whitespace-normal">
                On claim hold {holdWindow(provider.claimHold)}
              </StatusDot>
            </span>
          )}
        </span>
      ),
    },
    {
      // The prototype's NPI and "Taxonomy · license" columns, as one: there is
      // no room for both beside the claim hold below 1440px. The lines under
      // the NPI say which is which.
      key: 'npi',
      header: 'NPI',
      hideBelow: 'md',
      cell: (provider) => (
        <span className="block">
          {isValidNpi(provider.npi) ? (
            <span className="whitespace-nowrap tabular-nums">{provider.npi}</span>
          ) : (
            <StatusDot tone="critical">{provider.npi === '' ? 'NPI missing' : provider.npi}</StatusDot>
          )}
          <span className="whitespace-nowrap">
            <CellSub>Taxonomy {provider.taxonomyCode || '—'}</CellSub>
            <CellSub>License {provider.stateLicense || '—'}</CellSub>
          </span>
        </span>
      ),
    },
    { key: 'hold', header: 'Claim hold', hideBelow: 'xl', cell: holdCell },
    { key: 'providerType', header: 'Provider type', sortable: true, hideBelow: 'xl', cell: typeTag },
    activeColumn<Provider>({
      isActive: (provider) => provider.isActive,
      label: (provider) => providerName(provider),
      // The provider's own update, with only `is_active` changed.
      onChange: (provider, isActive) =>
        update.mutate(
          { id: provider.id, values: { ...toProviderFormValues(provider), isActive } },
          { onError: (error) => statusChangeFailed(providerName(provider), isActive, error) },
        ),
      pending: (provider) => update.isPending && update.variables.id === provider.id,
    }),
    actionsColumn<Provider>((provider) => (
      <RowActionButton
        action="edit"
        label={`Edit ${providerName(provider)}`}
        onClick={() => setEditing(provider)}
      />
    )),
  ]

  const newButton = (
    <Button variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => setEditing(null)}>
      New provider
    </Button>
  )

  return (
    <PageContainer>
      <PageHeader
        title="Providers"
        description="Add and manage the billing and rendering clinicians of your practices. Clinicians do not sign in."
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
        caption="Providers"
        columns={columns}
        rows={rows}
        getRowId={(provider) => String(provider.id)}
        loading={providers.isPending}
        error={providers.isError}
        onRetry={() => void providers.refetch()}
        sort={sort}
        onSortChange={setSort}
        empty={
          filter === null ? (
            <EmptyState
              icon={<Stethoscope size={20} />}
              title="No providers yet"
              description="Providers are the clinicians who treat and bill — every visit names a billing and a rendering provider, printed with their NPI on the claim."
              action={
                <Button
                  variant="primary"
                  icon={<Plus size={16} aria-hidden="true" />}
                  onClick={() => setEditing(null)}
                >
                  Add a provider
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<Stethoscope size={20} />}
              title="No providers in this practice"
              description="Add one, or show every practice."
              action={<Button onClick={() => setFilter(null)}>Show all practices</Button>}
            />
          )
        }
        footer={<span>{rows.length === 1 ? '1 provider' : `${rows.length} providers`}</span>}
      />

      {editing !== undefined && (
        <ProviderDialog
          key={editing?.id ?? 'new'}
          provider={editing}
          defaultPracticeId={filter}
          onClose={() => setEditing(undefined)}
        />
      )}
    </PageContainer>
  )
}
