import { CellSub, DataTable, type Column } from '@/components/ui/DataTable'
import { RowActionButton, actionsColumn, activeColumn } from '@/components/ui/RowActions'
import { EmptyState } from '@/components/ui/States'
import { placeOfServiceLabel } from '../model/place-of-service'
import type { Location } from '../schemas/practice'

/**
 * One practice's locations, as in the prototype: code, site and address, NPI,
 * default place of service, and the shared Active switch, Edit and Delete
 * actions (components/ui/RowActions). The switch deactivates or reactivates
 * the location after a confirmation, as the prototype's row action does;
 * Delete asks first too.
 *
 * Not shown, because the payloads do not carry them: the prototype's
 * "Primary" tag and its EMR-integration column.
 */
export function LocationsTable({
  locations,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  locations: readonly Location[]
  onEdit: (location: Location) => void
  onToggleActive: (location: Location) => void
  onDelete: (location: Location) => void
}) {
  const columns: ReadonlyArray<Column<Location>> = [
    {
      key: 'code',
      header: 'Code',
      width: '7rem',
      cell: (location) => (
        <span className="text-ink font-medium whitespace-nowrap tabular-nums">{location.code}</span>
      ),
    },
    {
      key: 'name',
      header: 'Location',
      primary: true,
      cell: (location) => (
        <span className="block break-words">
          {location.name}
          <CellSub>
            {location.address.line1}, {location.address.city} {location.address.zip}
          </CellSub>
        </span>
      ),
    },
    {
      key: 'npi',
      header: 'NPI',
      cell: (location) => <span className="whitespace-nowrap tabular-nums">{location.npi}</span>,
    },
    {
      key: 'pos',
      header: 'Default POS',
      cell: (location) =>
        placeOfServiceLabel(location.placeOfService) ?? <span className="text-n500">—</span>,
    },
    activeColumn<Location>({
      isActive: (location) => location.isActive,
      label: (location) => location.name,
      // As in the prototype, a change of status asks first (LocationStatusDialog).
      onChange: (location) => onToggleActive(location),
    }),
    actionsColumn<Location>((location) => (
      <>
        <RowActionButton action="edit" label={`Edit ${location.name}`} onClick={() => onEdit(location)} />
        <RowActionButton
          action="delete"
          label={`Delete ${location.name}`}
          onClick={() => onDelete(location)}
        />
      </>
    )),
  ]

  return (
    <DataTable
      caption="Locations"
      columns={columns}
      rows={locations}
      getRowId={(location) => String(location.id)}
      empty={<EmptyState title="No locations" description="Add a location to this practice." />}
    />
  )
}
