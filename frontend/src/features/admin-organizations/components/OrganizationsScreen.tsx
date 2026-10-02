import { useState } from 'react'
import { Layers, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { DataTable, type Column, type Sort } from '@/components/ui/DataTable'
import { RowActionButton, actionsColumn, activeColumn, statusChangeFailed } from '@/components/ui/RowActions'
import { EmptyState } from '@/components/ui/States'
import { PageContainer, PageHeader } from '@/components/shared/PageLayout'
import { useOrganizations, useUpdateOrganization } from '../queries/use-organizations'
import type { Organization } from '../schemas/organization'
import { OrganizationDialog } from './OrganizationDialog'

/**
 * Admin → Organizations: the list, and the dialog that creates or edits one.
 *
 * What the prototype shows and this screen does not, yet:
 * - the **Practices** and **Count** columns and the practice picker in the
 *   dialog. A practice now carries `organization_id` and is assigned to an
 *   organization from its own form (Admin → Practices & locations). Showing
 *   the practices here is a follow-up; assigning them from this dialog also
 *   needs an answer the payloads do not give — whether it is one request per
 *   practice or a call on the organization.
 * - visibility for System Admin only. The meeting of 2026-09-23 says a System
 *   Admin creates organizations, but there is no permission model to check
 *   against yet (ADR 0007); the server must enforce it regardless.
 *
 * The list is not paged: organizations are owner groups — a handful, not
 * thousands — and no API defines paging. It is sorted here, by name, because
 * the whole list is on hand.
 */
export function OrganizationsScreen() {
  const organizations = useOrganizations()
  const update = useUpdateOrganization()
  /** `undefined`: no dialog. `null`: creating. An organization: editing it. */
  const [editing, setEditing] = useState<Organization | null | undefined>(undefined)
  const [sort, setSort] = useState<Sort>({ key: 'name', direction: 'asc' })

  const rows = [...(organizations.data ?? [])].sort((a, b) => {
    const order = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    return sort.direction === 'asc' ? order : -order
  })

  const columns: ReadonlyArray<Column<Organization>> = [
    {
      key: 'name',
      header: 'Organization',
      primary: true,
      sortable: true,
      // Long names wrap instead of pushing the table wider than the screen.
      cell: (organization) => <span className="[overflow-wrap:anywhere]">{organization.name}</span>,
    },
    activeColumn<Organization>({
      isActive: (organization) => organization.isActive,
      label: (organization) => organization.name,
      // The organization's own update, with only `is_active` changed.
      onChange: (organization, isActive) =>
        update.mutate(
          { id: organization.id, input: { name: organization.name, isActive } },
          { onError: (error) => statusChangeFailed(organization.name, isActive, error) },
        ),
      pending: (organization) => update.isPending && update.variables.id === organization.id,
    }),
    actionsColumn<Organization>((organization) => (
      <RowActionButton
        action="edit"
        label={`Edit ${organization.name}`}
        onClick={() => setEditing(organization)}
      />
    )),
  ]

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

      <DataTable
        caption="Organizations"
        columns={columns}
        rows={rows}
        getRowId={(organization) => String(organization.id)}
        loading={organizations.isPending}
        error={organizations.isError}
        onRetry={() => void organizations.refetch()}
        sort={sort}
        onSortChange={setSort}
        empty={
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
        }
        footer={<span>{rows.length === 1 ? '1 organization' : `${rows.length} organizations`}</span>}
      />

      {editing !== undefined && (
        <OrganizationDialog
          key={editing?.id ?? 'new'}
          organization={editing}
          onClose={() => setEditing(undefined)}
        />
      )}
    </PageContainer>
  )
}
