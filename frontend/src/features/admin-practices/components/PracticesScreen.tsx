import { useState } from 'react'
import { Building2, Plus } from 'lucide-react'
import { StatusDot, Tag } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { CellSub, DataTable, type Column } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/States'
import { PageContainer, PageHeader } from '@/components/shared/PageLayout'
import { useOrganizations } from '@/features/admin-organizations'
import { usePractices } from '../queries/use-practices'
import type { Location, Practice } from '../schemas/practice'
import { LocationDialog } from './LocationDialog'
import { LocationStatusDialog } from './LocationStatusDialog'
import { PracticeDetails } from './PracticeDetails'
import { PracticeDialog } from './PracticeDialog'

/** What is open over the screen. One at a time. */
type Editing =
  | { kind: 'practice'; practice: Practice | null }
  | { kind: 'location'; practice: Practice; location: Location | null }
  | { kind: 'location-status'; practice: Practice; location: Location }

/**
 * Admin → Practices & locations, laid out as the prototype does: every
 * practice in a table; under it, the selected practice's organization, billing
 * constants and locations.
 *
 * The selected practice is in the URL (`?practice=<id>`) so a reload, the back
 * button and a shared link keep it; without one, the first practice is shown.
 *
 * Not built, because nothing defines them: search or filters (the prototype
 * has none), deleting a practice or location, moving a location to another
 * practice, and the prototype's primary-location and EMR-integration details
 * (absent from the payloads). Who may create a practice (a System Admin in the
 * prototype) is not checked: there is no permission model yet (ADR 0007), and
 * the server must enforce it regardless.
 */
export function PracticesScreen({ selectedId }: { selectedId: number | undefined }) {
  const practices = usePractices()
  const organizations = useOrganizations()
  const [editing, setEditing] = useState<Editing | null>(null)

  const rows = practices.data ?? []
  const selected = rows.find((practice) => practice.id === selectedId) ?? rows[0]
  const organization =
    selected?.organizationId == null
      ? undefined
      : organizations.data?.find((candidate) => candidate.id === selected.organizationId)

  const columns: ReadonlyArray<Column<Practice>> = [
    {
      key: 'code',
      header: 'Code',
      width: '6rem',
      // Below 640px the name needs the room; the code is in the details below.
      hideOnMobile: true,
      cell: (practice) => (
        <span className="text-ink font-medium [overflow-wrap:anywhere] tabular-nums">{practice.code}</span>
      ),
    },
    {
      key: 'name',
      header: 'Practice',
      primary: true,
      cell: (practice) => (
        <span className="block [overflow-wrap:anywhere]">
          {practice.name}
          {practice.dbaName !== undefined && <CellSub>DBA {practice.dbaName}</CellSub>}
        </span>
      ),
    },
    {
      key: 'npi',
      header: 'Group NPI',
      hideOnMobile: true,
      cell: (practice) => <span className="whitespace-nowrap tabular-nums">{practice.npi}</span>,
    },
    {
      key: 'taxId',
      header: 'Tax ID',
      hideOnMobile: true,
      cell: (practice) => <span className="whitespace-nowrap tabular-nums">{practice.taxId}</span>,
    },
    {
      key: 'taxonomy',
      header: 'Taxonomy',
      hideOnMobile: true,
      cell: (practice) => <span className="whitespace-nowrap tabular-nums">{practice.taxonomyCode}</span>,
    },
    {
      key: 'locations',
      header: 'Locations',
      align: 'right',
      hideOnMobile: true,
      // Active locations, as the prototype counts them.
      cell: (practice) => practice.locations.filter((location) => location.isActive).length,
    },
    {
      key: 'status',
      header: <span className="sr-only">Status</span>,
      align: 'right',
      cell: (practice) =>
        practice.id === selected?.id ? (
          <Tag tone="brand">Selected</Tag>
        ) : practice.isActive ? null : (
          <StatusDot tone="inert">Inactive</StatusDot>
        ),
    },
  ]

  return (
    <PageContainer>
      <PageHeader
        title="Practices & locations"
        description="Create and manage your practices and their locations."
        actions={
          <Button
            variant="primary"
            icon={<Plus size={16} aria-hidden="true" />}
            onClick={() => setEditing({ kind: 'practice', practice: null })}
          >
            New practice
          </Button>
        }
      />

      <DataTable
        caption="Practices"
        columns={columns}
        rows={rows}
        getRowId={(practice) => String(practice.id)}
        loading={practices.isPending}
        error={practices.isError}
        onRetry={() => void practices.refetch()}
        rowLink={(practice) => ({ to: '/admin/practices', search: { practice: practice.id }, replace: true })}
        empty={
          <EmptyState
            icon={<Building2 size={20} />}
            title="No practices yet"
            description="Create your first practice. You add its first location at the same time."
            action={
              <Button
                variant="primary"
                icon={<Plus size={16} aria-hidden="true" />}
                onClick={() => setEditing({ kind: 'practice', practice: null })}
              >
                New practice
              </Button>
            }
          />
        }
        footer={<span>{rows.length === 1 ? '1 practice' : `${rows.length} practices`}</span>}
      />

      {selected !== undefined && (
        <PracticeDetails
          practice={selected}
          organization={organization}
          practicesInOrganization={
            rows.filter((practice) => practice.organizationId === selected.organizationId).length
          }
          onEditPractice={() => setEditing({ kind: 'practice', practice: selected })}
          onAddLocation={() => setEditing({ kind: 'location', practice: selected, location: null })}
          onEditLocation={(location) => setEditing({ kind: 'location', practice: selected, location })}
          onToggleLocationActive={(location) =>
            setEditing({ kind: 'location-status', practice: selected, location })
          }
        />
      )}

      {editing?.kind === 'practice' && (
        <PracticeDialog
          key={editing.practice?.id ?? 'new'}
          practice={editing.practice}
          onClose={() => setEditing(null)}
        />
      )}
      {editing?.kind === 'location-status' && (
        <LocationStatusDialog
          key={editing.location.id}
          practice={editing.practice}
          location={editing.location}
          onClose={() => setEditing(null)}
        />
      )}
      {editing?.kind === 'location' && (
        <LocationDialog
          key={editing.location?.id ?? 'new'}
          practice={editing.practice}
          location={editing.location}
          onClose={() => setEditing(null)}
        />
      )}
    </PageContainer>
  )
}
