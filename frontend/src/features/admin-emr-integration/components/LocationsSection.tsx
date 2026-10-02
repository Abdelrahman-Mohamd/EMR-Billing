import type { ReactNode } from 'react'
import { Plug } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Section } from '@/components/ui/Card'
import { CellSub, DataTable, type Column } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/States'
import type { Practice } from '@/features/admin-practices'
import { formatIsoDate } from '@/lib/utils/dates'
import { formatWhen } from '@/lib/utils/format-when'
import {
  ELECTION_TONE,
  LINK_TONE,
  RESULT_TONE,
  type LocationIntegration,
  type Payload,
} from '../model/integration'

export type Location = Practice['locations'][number]

export interface LocationRow {
  location: Location
  integration: LocationIntegration
  /** The newest payload from it, if any. */
  last: Payload | undefined
}

/**
 * A practice's locations and their integration: a quiet line saying how far
 * they are along (linked / integrated / awaiting approval), then Location,
 * Unique Location ID, Link, Billing election, Last payload, and the one action
 * each location's state allows; the prototype's line about who approves under
 * the table. A plain section — heading and one rule — not a card.
 */
export function LocationsSection({
  practiceName,
  status,
  rows,
  loading,
  onRequest,
  onApprove,
  onElect,
}: {
  practiceName: string
  /** How far the locations are along, under the heading. */
  status: ReactNode
  rows: readonly LocationRow[]
  loading: boolean
  onRequest: (row: LocationRow) => void
  onApprove: (row: LocationRow) => void
  onElect: (row: LocationRow) => void
}) {
  const electionBadge = ({ integration }: LocationRow) => (
    <Badge tone={ELECTION_TONE[integration.election]}>{integration.election}</Badge>
  )

  const columns: ReadonlyArray<Column<LocationRow>> = [
    {
      key: 'location',
      header: 'Location',
      primary: true,
      cell: (row) => (
        <span className="block [overflow-wrap:anywhere]">
          {row.location.name}
          <CellSub>
            {row.location.code}
            {/* Until its column appears (1280px), the Unique Location ID rides under the location. */}
            {row.integration.uniqueLocationId !== '' && (
              <span className="xl:hidden">
                <span aria-hidden="true"> · </span>
                <span className="whitespace-nowrap">{row.integration.uniqueLocationId}</span>
              </span>
            )}
          </CellSub>
          {/* On a phone, where their columns are hidden, the link and election ride under it too. */}
          <span className="mt-1.5 flex flex-wrap gap-1.5 md:hidden">
            <Badge tone={LINK_TONE[row.integration.link]}>{row.integration.link}</Badge>
            {electionBadge(row)}
          </span>
          {row.last !== undefined && (
            <span className="xl:hidden">
              <CellSub>
                Last payload {formatWhen(row.last.at).label} · {row.last.result}
              </CellSub>
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'uid',
      header: 'Unique Location ID',
      hideBelow: 'xl',
      cell: ({ integration }) =>
        integration.uniqueLocationId === '' ? (
          <span className="text-n400">—</span>
        ) : (
          <span className="text-ink font-medium [overflow-wrap:anywhere] tabular-nums">
            {integration.uniqueLocationId}
          </span>
        ),
    },
    {
      key: 'link',
      header: 'Link',
      hideBelow: 'md',
      cell: ({ integration }) => (
        <span className="block">
          <Badge tone={LINK_TONE[integration.link]}>{integration.link}</Badge>
          {integration.link === 'Requested' && integration.requestedOn !== null ? (
            <CellSub>
              {integration.requestedBy === null ? '' : `By ${integration.requestedBy} · `}
              {formatIsoDate(integration.requestedOn)}
            </CellSub>
          ) : integration.link === 'Linked' && integration.linkedOn !== null ? (
            <CellSub>Since {formatIsoDate(integration.linkedOn)}</CellSub>
          ) : null}
        </span>
      ),
    },
    { key: 'election', header: 'Billing election', hideBelow: 'md', cell: electionBadge },
    {
      key: 'last',
      header: 'Last payload',
      hideBelow: 'xl',
      cell: ({ last }) =>
        last === undefined ? (
          <span className="text-n400">—</span>
        ) : (
          <span className="block whitespace-nowrap">
            {formatWhen(last.at).label}
            <span className="mt-1 block">
              <Badge tone={RESULT_TONE[last.result]}>{last.result}</Badge>
            </span>
          </span>
        ),
    },
    {
      key: 'action',
      header: <span className="sr-only">Action</span>,
      align: 'right',
      interactive: true,
      cell: (row) =>
        row.integration.link === 'Not linked' ? (
          <Button size="sm" onClick={() => onRequest(row)}>
            Request integration
          </Button>
        ) : row.integration.link === 'Requested' ? (
          <Button size="sm" onClick={() => onApprove(row)}>
            Approve &amp; link
          </Button>
        ) : (
          <Button size="sm" onClick={() => onElect(row)}>
            {row.integration.election === 'Integrated' ? 'Switch to EMR-only' : 'Switch to integrated'}
          </Button>
        ),
    },
  ]

  return (
    <Section title="Locations" className="pb-0">
      <p className="text-micro text-n500 mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">{status}</p>
      <DataTable
        className="mt-1"
        caption={`Locations of ${practiceName}`}
        columns={columns}
        rows={rows}
        getRowId={(row) => String(row.location.id)}
        loading={loading}
        empty={
          <EmptyState
            icon={<Plug size={20} />}
            title="No locations"
            description="Integration is set up per location. Add the practice's locations in Practices & locations."
          />
        }
      />
      <p className="text-micro text-n500 mt-3">
        A System Admin or Organization Admin approves integration requests.
      </p>
    </Section>
  )
}
