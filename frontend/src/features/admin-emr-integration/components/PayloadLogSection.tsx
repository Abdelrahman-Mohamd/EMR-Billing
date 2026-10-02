import { useState } from 'react'
import { Plug } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Section } from '@/components/ui/Card'
import { CellSub, DataTable, type Column } from '@/components/ui/DataTable'
import { FilterPills } from '@/components/ui/FilterPills'
import { Pagination } from '@/components/ui/Pagination'
import { EmptyState } from '@/components/ui/States'
import { formatWhen } from '@/lib/utils/format-when'
import { PAYLOAD_RESULTS, RESULT_TONE, type Payload } from '../model/integration'
import { plural } from '../model/summary'

/** The prototype pages the payload log 10 at a time. */
const PAGE_SIZE = 10

/**
 * The payload log of one practice's locations, as a plain section: the
 * prototype's subtitle, result pills with counts (none on = every result),
 * then Received, Location, Patient (with its Internal Record ID under it),
 * Result and Detail, newest first, 10 a page.
 *
 * The filter and page are this section's own: give it a `key` per practice so
 * they start over when the practice changes. The filter stays out of the URL
 * like the rest of the log — a patient is never far from it.
 */
export function PayloadLogSection({
  payloads,
  locationName,
  loading,
}: {
  /** This practice's payloads, newest first. */
  payloads: readonly Payload[]
  locationName: (locationId: number) => string
  loading: boolean
}) {
  const [results, setResults] = useState<string[]>([])
  const [page, setPage] = useState(1)

  const log = payloads.filter((payload) => results.length === 0 || results.includes(payload.result))
  const pageCount = Math.max(1, Math.ceil(log.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const pageRows = log.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const summary =
    log.length <= PAGE_SIZE
      ? plural(log.length, 'payload')
      : `Showing ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, log.length)} of ${log.length} payloads`

  const columns: ReadonlyArray<Column<Payload>> = [
    {
      key: 'at',
      header: 'Received',
      cell: (payload) => {
        const when = formatWhen(payload.at)
        return (
          <span className="block whitespace-nowrap">
            {when.label}
            {when.date !== '' && <CellSub>{when.date}</CellSub>}
          </span>
        )
      },
    },
    {
      key: 'location',
      header: 'Location',
      hideBelow: 'xl',
      cell: (payload) => <span className="[overflow-wrap:anywhere]">{locationName(payload.locationId)}</span>,
    },
    {
      key: 'patient',
      header: 'Patient',
      primary: true,
      cell: (payload) => (
        <span className="block [overflow-wrap:anywhere]">
          <span className="xl:whitespace-nowrap">{payload.patient}</span>
          {/* The Internal Record ID — the EMR's id for this patient's note — rides under the
              patient at every width, leaving the detail room to read; below 1280px, the location too. */}
          <CellSub>
            <span className="xl:hidden">
              {locationName(payload.locationId)}
              <span aria-hidden="true"> · </span>
            </span>
            <span className="sr-only">Internal Record ID </span>
            <span className="whitespace-nowrap tabular-nums">{payload.recordId}</span>
          </CellSub>
          {/* …and, on a phone, the result and detail too. */}
          <span className="sm:hidden">
            <span className="mt-1 block">
              <Badge tone={RESULT_TONE[payload.result]}>{payload.result}</Badge>
            </span>
            <CellSub>{payload.detail}</CellSub>
          </span>
        </span>
      ),
    },
    {
      key: 'result',
      header: 'Result',
      hideOnMobile: true,
      cell: (payload) => <Badge tone={RESULT_TONE[payload.result]}>{payload.result}</Badge>,
    },
    {
      key: 'detail',
      header: 'Detail',
      hideOnMobile: true,
      cell: (payload) => <span className="block [overflow-wrap:anywhere]">{payload.detail}</span>,
    },
  ]

  return (
    <Section title="Payload log" className="pb-0">
      <p className="text-micro text-n500 mt-2.5">
        Every payload received from the EMR and what reconciliation did with it
      </p>
      <FilterPills
        label="Filter by result"
        className="mt-4"
        options={PAYLOAD_RESULTS.map((result) => ({
          value: result,
          label: result,
          count: payloads.filter((payload) => payload.result === result).length,
        }))}
        selected={results}
        onChange={(next) => {
          setResults(next)
          setPage(1)
        }}
      />
      <DataTable
        className="mt-2"
        caption="Payload log"
        columns={columns}
        rows={pageRows}
        getRowId={(payload) => payload.id}
        loading={loading}
        empty={
          <EmptyState
            icon={<Plug size={20} />}
            title="No payloads"
            description="Payloads appear here when a linked location sends a finalized note."
          />
        }
        footer={
          log.length > 0 ? (
            <Pagination page={currentPage} pageCount={pageCount} onPageChange={setPage} summary={summary} />
          ) : undefined
        }
      />
    </Section>
  )
}
