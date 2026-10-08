import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Plus, Stethoscope } from 'lucide-react'
import { isApiError, userMessage } from '@/lib/api/api-error'
import { isValidNpi } from '@/lib/validation/npi'
import { toast } from '@/stores/toast-store'
import { StatusDot, Tag } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { CellSub, DataTable, type Column, type Sort } from '@/components/ui/DataTable'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { RowActionButton, actionsColumn, StatusChangeDialog, activeColumn } from '@/components/ui/RowActions'
import { EmptyState } from '@/components/ui/States'
import { FilterBar, PageContainer, PageHeader } from '@/components/shared/PageLayout'
import { PracticeSelect } from '@/features/admin-practices'
import { providerName, providerTypeMeaning } from '../model/provider-options'
import { useDeleteProvider, useProviders, useSetProviderActive } from '../queries/use-providers'
import type { Provider } from '../schemas/provider'
import { ProviderDialog } from './ProviderDialog'

/**
 * Setup → Providers: the list and the dialog that adds or edits one. Laid out
 * as the updated prototype's list — Provider ID, provider (name and
 * specialty), NPI (marked when missing or invalid), taxonomy · license,
 * provider type (with what it means) and Active (asks first) — with Edit and
 * Delete, and a practice filter kept in the URL (`?practice=<id>`), as on the
 * other Setup screens. Unfiltered, each provider's practice is named under
 * them. The prototype's claim hold column is not in the contract, so it is
 * left out.
 *
 * Every provider is read (all of the server's pages) and filtered and sorted
 * here, as the prototype does — not searched. Sorted by Provider ID, as the
 * prototype sorts it; also by name (last name) and by provider type.
 */
/** The type as the server words it, or its value when it sent no label. */
const typeName = (provider: Provider) => provider.typeLabel || provider.type

export function ProvidersScreen({ practiceFilter }: { practiceFilter: number | undefined }) {
  const navigate = useNavigate()
  const providers = useProviders()
  const setActive = useSetProviderActive()
  const remove = useDeleteProvider()
  /** `undefined`: no dialog. `null`: adding. A provider: editing them. */
  const [editing, setEditing] = useState<Provider | null | undefined>(undefined)
  /** The row whose Active switch was flipped, waiting for confirmation. */
  const [statusOf, setStatusOf] = useState<Provider | null>(null)
  const [deleting, setDeleting] = useState<Provider | null>(null)
  const [sort, setSort] = useState<Sort>({ key: 'code', direction: 'asc' })

  const filter = practiceFilter === undefined ? null : String(practiceFilter)
  const setFilter = (value: string | null) =>
    void navigate({
      to: '/setup/providers',
      search: value === null ? {} : { practice: Number(value) },
      replace: true,
    })

  const compare = (a: Provider, b: Provider) => {
    const text = (left: string, right: string) =>
      left.localeCompare(right, undefined, { sensitivity: 'base', numeric: true })
    if (sort.key === 'name') return text(a.lastName, b.lastName) || text(a.firstName, b.firstName)
    if (sort.key === 'providerType') return text(typeName(a), typeName(b))
    return text(a.code, b.code)
  }
  const rows = (providers.data ?? [])
    .filter((provider) => practiceFilter === undefined || provider.practiceId === practiceFilter)
    .sort((a, b) => (sort.direction === 'asc' ? compare(a, b) : -compare(a, b)))

  const typeTag = (provider: Provider) => {
    const meaning = providerTypeMeaning(provider.type)
    return (
      <span className="block">
        <Tag tone={provider.type === 'rendering' ? 'attention' : 'inert'}>{typeName(provider)}</Tag>
        {meaning !== undefined && <CellSub>{meaning}</CellSub>}
      </span>
    )
  }

  const columns: ReadonlyArray<Column<Provider>> = [
    {
      key: 'code',
      header: 'Provider ID',
      sortable: true,
      cell: (provider) => <span className="text-ink font-medium whitespace-nowrap">{provider.code}</span>,
    },
    {
      key: 'name',
      header: 'Provider',
      primary: true,
      sortable: true,
      cell: (provider) => (
        // From 1280px, room for "Aisha Rahman, PT, DPT" on one line beside the hold and type columns.
        <span className="block break-words xl:min-w-44">
          {providerName(provider) || '(unnamed)'}
          <CellSub>{provider.specialty || '—'}</CellSub>
          {practiceFilter === undefined && provider.practiceName !== '' && (
            <CellSub>{provider.practiceName}</CellSub>
          )}
        </span>
      ),
    },
    {
      // The prototype's NPI and "Taxonomy · license" columns, as one: there is
      // no room for both beside the type and Active below 1440px. The lines
      // under the NPI say which is which.
      key: 'npi',
      header: 'NPI',
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
    { key: 'providerType', header: 'Provider type', sortable: true, cell: typeTag },
    activeColumn<Provider>({
      isActive: (provider) => provider.isActive,
      label: (provider) => providerName(provider),
      // Asks first (StatusChangeDialog below).
      onChange: (provider) => setStatusOf(provider),
    }),
    actionsColumn<Provider>((provider) => (
      <>
        <RowActionButton
          action="edit"
          label={`Edit ${providerName(provider)}`}
          onClick={() => setEditing(provider)}
        />
        <RowActionButton
          action="delete"
          label={`Delete ${providerName(provider)}`}
          onClick={() => setDeleting(provider)}
        />
      </>
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
      {statusOf !== null && (
        <StatusChangeDialog
          name={providerName(statusOf)}
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
        title={`Delete ${deleting === null ? '' : providerName(deleting)}?`}
        confirmLabel="Delete provider"
        tone="destructive"
        onConfirm={async () => {
          if (deleting === null) return
          const name = providerName(deleting)
          try {
            const message = await remove.mutateAsync(deleting.id)
            toast.success(message ?? `${name} deleted`)
          } catch (error) {
            toast.error(
              `${name} was not deleted`,
              isApiError(error) ? userMessage(error) : 'Something went wrong. Please try again.',
            )
          }
        }}
      />
    </PageContainer>
  )
}
