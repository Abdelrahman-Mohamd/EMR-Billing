import { useState, type ReactNode } from 'react'
import { CircleCheck } from 'lucide-react'
import { Tag } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { CellSub, DataTable, type Column, type Sort } from '@/components/ui/DataTable'
import { FilterPills } from '@/components/ui/FilterPills'
import { Pagination } from '@/components/ui/Pagination'
import { actionsColumn } from '@/components/ui/RowActions'
import { EmptyState } from '@/components/ui/States'
import { listName, usePatientRecords } from '@/features/patients'
import { cn } from '@/lib/utils/cn'
import { formatIsoDate, todayIso } from '@/lib/utils/dates'
import { formatWhen } from '@/lib/utils/format-when'
import {
  EXCEPTION_LEVELS,
  canResolve,
  type BillingException,
  type ExceptionLevel,
} from '../model/billing-exception'
import { ResolveDialog } from './resolve/ResolveDialog'

/** The prototype pages its lists 12 at a time. */
export const EXCEPTIONS_PAGE_SIZE = 12

/**
 * One of the Exceptions lists, as the prototype has it: Billing exceptions
 * (open) or Resolved. Level pills with their counts filter it; the table shows
 * Level, Exception trigger (with its particulars), Record, Detected, then for
 * open ones Owner, Due and Resolve, for resolved ones when and by whom.
 *
 * Open rows carry the prototype's marker: red for Charge and Payment, amber
 * for the others. Payment-level exceptions are fixed against claims and
 * remittances, which do not exist here yet, so they have no Resolve.
 */
export function ExceptionList({
  status,
  exceptions,
  ready,
  initialLevel,
}: {
  status: 'Open' | 'Resolved'
  /** Already narrowed to the practice in view. */
  exceptions: readonly BillingException[]
  ready: boolean
  /** A link may open the list on one level (`?level=Payment`). */
  initialLevel: ExceptionLevel | undefined
}) {
  const records = usePatientRecords()
  const [levels, setLevels] = useState<string[]>(initialLevel === undefined ? [] : [initialLevel])
  const [sort, setSort] = useState<Sort>({ key: 'detected', direction: 'desc' })
  const [page, setPage] = useState(1)
  const [resolving, setResolving] = useState<BillingException | null>(null)
  const open = status === 'Open'
  const today = todayIso()

  const recordName = (exception: BillingException): string => {
    if (exception.record.kind === 'era') return `ERA ${exception.record.control}`
    const { patientId } = exception.record
    const patient = records.patients.find((item) => item.id === patientId)
    return patient === undefined ? 'Patient' : listName(patient)
  }
  const recordSub = (exception: BillingException): string =>
    exception.record.kind === 'era'
      ? exception.record.payerName
      : `DOS ${formatIsoDate(exception.record.dos)} · record ${exception.record.recordId}`

  const list = exceptions.filter((exception) => exception.status === status)
  const counts = Object.fromEntries(
    EXCEPTION_LEVELS.map((level) => [level, list.filter((exception) => exception.level === level).length]),
  )
  const rows = list
    .filter((exception) => levels.length === 0 || levels.includes(exception.level))
    .sort((a, b) => {
      const key = (exception: BillingException): string | number => {
        switch (sort.key) {
          case 'level':
            return EXCEPTION_LEVELS.indexOf(exception.level)
          case 'trigger':
            return exception.trigger.toLowerCase()
          case 'record':
            return recordName(exception).toLowerCase()
          case 'due':
            // No due date sorts last either way round.
            return exception.due ?? (sort.direction === 'asc' ? '9999' : '0000')
          default:
            return exception.detectedAt
        }
      }
      const [x, y] = [key(a), key(b)]
      const order = x < y ? -1 : x > y ? 1 : 0
      return sort.direction === 'asc' ? order : -order
    })
  const pageCount = Math.max(1, Math.ceil(rows.length / EXCEPTIONS_PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const pageRows = rows.slice((currentPage - 1) * EXCEPTIONS_PAGE_SIZE, currentPage * EXCEPTIONS_PAGE_SIZE)
  const summary =
    rows.length <= EXCEPTIONS_PAGE_SIZE
      ? `${rows.length} ${rows.length === 1 ? 'exception' : 'exceptions'}`
      : `Showing ${(currentPage - 1) * EXCEPTIONS_PAGE_SIZE + 1}–${Math.min(currentPage * EXCEPTIONS_PAGE_SIZE, rows.length)} of ${rows.length} exceptions`

  const levelTag = (exception: BillingException) => (
    <Tag tone={exception.level === 'Payment' ? 'attention' : 'brand'}>{exception.level}</Tag>
  )

  const columns: Array<Column<BillingException>> = [
    {
      key: 'level',
      header: 'Level',
      sortable: true,
      hideOnMobile: true,
      cell: (exception) => (
        <span className="flex items-center gap-2.5">
          {open && (
            <span
              aria-hidden="true"
              className={cn(
                'h-5 w-[3px] flex-none rounded-full',
                exception.level === 'Charge' || exception.level === 'Payment' ? 'bg-critical' : 'bg-warning',
              )}
            />
          )}
          {levelTag(exception)}
        </span>
      ),
    },
    {
      key: 'trigger',
      header: 'Exception trigger',
      sortable: true,
      primary: true,
      cell: (exception) => (
        <span className="block min-w-0">
          {/* On a phone the level rides above the trigger. */}
          <span className="mb-1 block sm:hidden">{levelTag(exception)}</span>
          <span className="break-words">{exception.trigger}</span>
          <CellSub>{exception.detail}</CellSub>
          {/* Until the Record column appears, the record rides under the particulars. */}
          <span className="md:hidden">
            <CellSub>
              {recordName(exception)} · {recordSub(exception)}
            </CellSub>
          </span>
        </span>
      ),
    },
    {
      key: 'record',
      header: 'Record',
      sortable: true,
      hideBelow: 'md',
      cell: (exception) => (
        <span className="block min-w-0">
          <span className="text-ink block font-medium break-words">{recordName(exception)}</span>
          <CellSub>
            <span className="[overflow-wrap:anywhere]">{recordSub(exception)}</span>
          </CellSub>
        </span>
      ),
    },
    {
      key: 'detected',
      header: 'Detected',
      sortable: true,
      hideBelow: 'lg',
      cell: (exception) => (
        <span className="whitespace-nowrap">{formatWhen(exception.detectedAt).label}</span>
      ),
    },
    ...(open
      ? ([
          {
            key: 'owner',
            header: 'Owner',
            hideBelow: 'xl',
            cell: (exception) =>
              exception.owner === null ? <span className="text-n500">Unassigned</span> : exception.owner,
          },
          {
            key: 'due',
            header: 'Due',
            sortable: true,
            hideBelow: 'lg',
            cell: (exception) =>
              exception.due === null ? (
                <span className="text-n400">—</span>
              ) : (
                <span
                  className={cn('whitespace-nowrap tabular-nums', exception.due < today && 'text-critical')}
                >
                  {formatIsoDate(exception.due)}
                  {exception.due < today && <span className="sr-only"> (overdue)</span>}
                </span>
              ),
          },
          actionsColumn<BillingException>((exception) =>
            canResolve(exception) ? (
              <Button
                size="sm"
                aria-label={`Resolve ${exception.trigger} — ${recordName(exception)}`}
                onClick={() => setResolving(exception)}
              >
                Resolve
              </Button>
            ) : null,
          ),
        ] satisfies Array<Column<BillingException>>)
      : ([
          {
            key: 'resolved',
            header: 'Resolved',
            cell: (exception) => (
              <span className="block whitespace-nowrap">
                {exception.resolvedAt === null ? '' : formatWhen(exception.resolvedAt).label}
                {exception.resolvedBy !== null && <CellSub>{exception.resolvedBy}</CellSub>}
              </span>
            ),
          },
        ] satisfies Array<Column<BillingException>>)),
  ]

  const empty: ReactNode = open ? (
    <EmptyState
      icon={<CircleCheck size={20} />}
      title="No open billing exceptions"
      description="Payloads with missing fields, dummy data or unpriced codes are intercepted here before claim processing."
    />
  ) : (
    <EmptyState icon={<CircleCheck size={20} />} title="Nothing resolved yet" />
  )

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <FilterPills
          label="Filter by level"
          options={EXCEPTION_LEVELS.map((level) => ({
            value: level,
            label: level,
            count: counts[level] ?? 0,
          }))}
          selected={levels}
          onChange={(next) => {
            setLevels(next)
            setPage(1)
          }}
        />
        {levels.length > 0 && (
          <Button
            size="sm"
            variant="quiet"
            onClick={() => {
              setLevels([])
              setPage(1)
            }}
          >
            Show all levels
          </Button>
        )}
      </div>

      <DataTable
        caption={open ? 'Billing exceptions' : 'Resolved exceptions'}
        columns={columns}
        rows={pageRows}
        getRowId={(exception) => exception.id}
        loading={!ready}
        sort={sort}
        onSortChange={(next) => {
          setSort(next)
          setPage(1)
        }}
        empty={<div className="pt-6">{empty}</div>}
        footer={
          rows.length > 0 ? (
            <Pagination page={currentPage} pageCount={pageCount} onPageChange={setPage} summary={summary} />
          ) : undefined
        }
      />

      {resolving !== null && <ResolveDialog exception={resolving} onClose={() => setResolving(null)} />}
    </>
  )
}
