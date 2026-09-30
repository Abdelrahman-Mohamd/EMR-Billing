import { Ban, Pencil, RotateCcw } from 'lucide-react'
import { StatusDot } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { CellSub, DataTable, type Column } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/States'
import { placeOfServiceLabel } from '../model/place-of-service'
import type { Location } from '../schemas/practice'

/**
 * One practice's locations, as in the prototype: code, site and address, NPI,
 * default place of service, status. The whole row edits the location; the
 * last cell deactivates or reactivates it, as the prototype's row action does.
 *
 * Not shown, because the payloads do not carry them: the prototype's
 * "Primary" tag and its EMR-integration column.
 */
export function LocationsTable({
  locations,
  onEdit,
  onToggleActive,
}: {
  locations: readonly Location[]
  onEdit: (location: Location) => void
  onToggleActive: (location: Location) => void
}) {
  const columns: ReadonlyArray<Column<Location>> = [
    {
      key: 'code',
      header: 'Code',
      width: '7rem',
      // Below 1280px the name needs the room; the code rides under it there.
      hideBelow: 'xl',
      cell: (location) => (
        <span className="text-ink font-medium whitespace-nowrap tabular-nums">{location.code}</span>
      ),
    },
    {
      key: 'name',
      header: 'Location',
      primary: true,
      cell: (location) => (
        <span className="block [overflow-wrap:anywhere]">
          {location.name}
          <CellSub>
            <span className="xl:hidden">
              <span className="text-n600 font-medium tabular-nums">{location.code}</span>
              <span aria-hidden="true"> · </span>
            </span>
            {location.address.line1}, {location.address.city} {location.address.zip}
          </CellSub>
        </span>
      ),
    },
    {
      key: 'npi',
      header: 'NPI',
      hideOnMobile: true,
      cell: (location) => <span className="whitespace-nowrap tabular-nums">{location.npi}</span>,
    },
    {
      key: 'pos',
      header: 'Default POS',
      // Below 1280px it is in the location's edit dialog.
      hideBelow: 'xl',
      cell: (location) =>
        placeOfServiceLabel(location.placeOfService) ?? <span className="text-n500">—</span>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (location) =>
        location.isActive ? (
          <StatusDot tone="success">Active</StatusDot>
        ) : (
          <StatusDot tone="inert">Inactive</StatusDot>
        ),
    },
    {
      key: 'edit',
      header: <span className="sr-only">Edit</span>,
      align: 'right',
      width: '3rem',
      hideOnMobile: true,
      // The row is the edit button (rowAction); the pencil only says so.
      cell: () => <Pencil size={16} aria-hidden="true" className="text-n400 ml-auto" />,
    },
    {
      key: 'activation',
      header: <span className="sr-only">Deactivate or reactivate</span>,
      align: 'right',
      width: '3.5rem',
      // Its own control, lifted above the row's edit button.
      interactive: true,
      cell: (location) => (
        <Button
          size="xs"
          variant={location.isActive ? 'danger' : 'default'}
          icon={
            location.isActive ? (
              <Ban size={14} aria-hidden="true" />
            ) : (
              <RotateCcw size={14} aria-hidden="true" />
            )
          }
          aria-label={location.isActive ? `Deactivate ${location.name}` : `Reactivate ${location.name}`}
          title={location.isActive ? 'Deactivate' : 'Reactivate'}
          onClick={() => onToggleActive(location)}
        />
      ),
    },
  ]

  return (
    <DataTable
      caption="Locations"
      columns={columns}
      rows={locations}
      getRowId={(location) => String(location.id)}
      rowAction={{ label: (location) => `Edit ${location.name}`, onAction: onEdit }}
      empty={<EmptyState title="No locations" description="Add a location to this practice." />}
    />
  )
}
