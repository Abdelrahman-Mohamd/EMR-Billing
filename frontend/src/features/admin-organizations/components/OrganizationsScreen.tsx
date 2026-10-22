import { useState } from 'react'
import { Layers, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { Pagination } from '@/components/ui/Pagination'
import { RowActionButton, StatusChangeDialog, actionsColumn, activeColumn } from '@/components/ui/RowActions'
import { EmptyState } from '@/components/ui/States'
import { SearchInput } from '@/components/ui/Input'
import { FilterBar, PageContainer, PageHeader } from '@/components/shared/PageLayout'
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value'
import { isApiError, userMessage } from '@/lib/api/api-error'
import { toast } from '@/stores/toast-store'
import {
  useDeleteOrganization,
  useOrganizationsPage,
  useSetOrganizationActive,
} from '../queries/use-organizations'
import type { Organization } from '../schemas/organization'
import { OrganizationDialog } from './OrganizationDialog'

/**
 * Admin → Organizations: the list, the dialog that creates or edits one, and
 * delete (after a confirmation).
 *
 * The list is the server's: 15 a page, in the server's order, with "Showing
 * 1–15 of N organizations" and a pager. The search is the server's (`search`,
 * the name in part; asked once typing pauses, from page 1). The server takes
 * no sort, so the name column does not sort — sorting one page would misstate
 * the order of the whole list.
 *
 * Practices: the count the list sends (`practices_count`). The prototype also
 * names them in a column, and picks them in the dialog; the list does not send
 * their names, and assigning a practice is done from the practice (Admin →
 * Practices & locations), so neither is built.
 *
 * Visibility for System Admin only (the meeting of 2026-09-23) has no
 * permission model to check against yet (ADR 0007); the server must enforce
 * it regardless.
 */
export function OrganizationsScreen() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const query = useDebouncedValue(search.trim())
  const organizations = useOrganizationsPage(page, query)
  const setActive = useSetOrganizationActive()
  const remove = useDeleteOrganization()
  /** `undefined`: no dialog. `null`: creating. An organization: editing it. */
  const [editing, setEditing] = useState<Organization | null | undefined>(undefined)
  const [deleting, setDeleting] = useState<Organization | null>(null)
  /** The organization whose Active switch was flipped, waiting for confirmation. */
  const [statusOf, setStatusOf] = useState<Organization | null>(null)

  const rows = organizations.data?.organizations ?? []
  const total = organizations.data?.total ?? 0
  const pageCount = organizations.data?.pageCount ?? 1

  const confirmDelete = async (organization: Organization) => {
    try {
      const message = await remove.mutateAsync(organization.id)
      toast.success(message ?? `${organization.name} deleted`)
      // The last row of the last page: step back rather than show an empty page.
      if (rows.length === 1 && page > 1) setPage(page - 1)
    } catch (error) {
      toast.error(
        `${organization.name} was not deleted`,
        isApiError(error) ? userMessage(error) : 'Something went wrong. Please try again.',
      )
    }
  }

  const columns: ReadonlyArray<Column<Organization>> = [
    {
      key: 'name',
      header: 'Organization',
      primary: true,
      // Long names wrap instead of pushing the table wider than the screen.
      cell: (organization) => <span className="break-words">{organization.name}</span>,
    },
    {
      key: 'practices',
      header: 'Practices',
      align: 'right',
      // A phone keeps the name, the switch and both actions in view.
      cell: (organization) => <span className="tabular-nums">{organization.practicesCount}</span>,
    },
    activeColumn<Organization>({
      isActive: (organization) => organization.isActive,
      label: (organization) => organization.name,
      // Asks first (StatusChangeDialog below).
      onChange: (organization) => setStatusOf(organization),
    }),
    actionsColumn<Organization>((organization) => (
      <>
        <RowActionButton
          action="edit"
          label={`Edit ${organization.name}`}
          onClick={() => setEditing(organization)}
        />
        <RowActionButton
          action="delete"
          label={`Delete ${organization.name}`}
          onClick={() => setDeleting(organization)}
        />
      </>
    )),
  ]

  const summary =
    pageCount <= 1
      ? total === 1
        ? '1 organization'
        : `${total} organizations`
      : `Showing ${organizations.data?.from ?? 0}–${organizations.data?.to ?? 0} of ${total} organizations`

  return (
    <PageContainer>
      <PageHeader
        title="Organizations"
        description="Create and manage the organizations that group your practices."
        actions={
          <Button
            variant="primary"
            icon={<Plus size={16} aria-hidden="true" />}
            onClick={() => setEditing(null)}
          >
            New organization
          </Button>
        }
      />

      <FilterBar
        search={
          <SearchInput
            aria-label="Search organizations by name"
            placeholder="Search by name…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            autoComplete="off"
          />
        }
        {...(search === '' ? {} : { onReset: () => setSearch('') })}
      />

      <DataTable
        caption="Organizations"
        columns={columns}
        rows={rows}
        getRowId={(organization) => String(organization.id)}
        loading={organizations.isPending}
        error={organizations.isError}
        onRetry={() => void organizations.refetch()}
        empty={
          query !== '' ? (
            <EmptyState
              icon={<Layers size={20} />}
              title="No organizations match"
              description="Try another name."
              action={<Button onClick={() => setSearch('')}>Clear search</Button>}
            />
          ) : (
            <EmptyState
              icon={<Layers size={20} />}
              title="No organizations"
              description="Create an organization to group practices that share an owner."
              action={
                <Button
                  variant="primary"
                  icon={<Plus size={16} aria-hidden="true" />}
                  onClick={() => setEditing(null)}
                >
                  New organization
                </Button>
              }
            />
          )
        }
        footer={
          total > 0 ? (
            <Pagination page={page} pageCount={pageCount} onPageChange={setPage} summary={summary} />
          ) : undefined
        }
      />

      {editing !== undefined && (
        <OrganizationDialog
          key={editing?.id ?? 'new'}
          organization={editing}
          onClose={() => setEditing(undefined)}
        />
      )}
      {statusOf !== null && (
        <StatusChangeDialog
          key={statusOf.id}
          name={statusOf.name}
          isActive={statusOf.isActive}
          onConfirm={() => setActive.mutateAsync({ organization: statusOf, isActive: !statusOf.isActive })}
          onClose={() => setStatusOf(null)}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title={`Delete ${deleting?.name ?? ''}?`}
        // What deleting does to its practices is not defined, so only the count is stated.
        {...(deleting !== null && deleting.practicesCount > 0
          ? {
              description: `It groups ${deleting.practicesCount === 1 ? '1 practice' : `${deleting.practicesCount} practices`}.`,
            }
          : {})}
        confirmLabel="Delete organization"
        tone="destructive"
        onConfirm={() => (deleting === null ? undefined : confirmDelete(deleting))}
      />
    </PageContainer>
  )
}
