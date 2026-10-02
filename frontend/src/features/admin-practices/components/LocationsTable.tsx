import { CellSub, DataTable, type Column } from '@/components/ui/DataTable'
import { RowActionButton, actionsColumn, activeColumn } from '@/components/ui/RowActions'
import { EmptyState } from '@/components/ui/States'
import { placeOfServiceLabel } from '../model/place-of-service'
import type { Location } from '../schemas/practice'

/**
 * One practice's locations, as in the prototype: code, site and address, NPI,
 * default place of service, and the shared Active switch and Edit action
 * (components/ui/RowActions). The switch deactivates or reactivates the
 * location after a confirmation, as the prototype's row action does.
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
    activeColumn<Location>({
      isActive: (location) => location.isActive,
      label: (location) => location.name,
      // As in the prototype, a change of status asks first (LocationStatusDialog).
      onChange: (location) => onToggleActive(location),
    }),
    actionsColumn<Location>((location) => (
      <RowActionButton action="edit" label={`Edit ${location.name}`} onClick={() => onEdit(location)} />
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
