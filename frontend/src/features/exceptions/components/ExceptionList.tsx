import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { CircleCheck } from 'lucide-react'
import { isApiError, userMessage } from '@/lib/api/api-error'
import { toast } from '@/stores/toast-store'
import { Tag } from '@/components/ui/Badge'
import { Button, buttonClass } from '@/components/ui/Button'
import { CellSub, DataTable, type Column } from '@/components/ui/DataTable'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { Pagination } from '@/components/ui/Pagination'
import { RowActionButton, actionsColumn } from '@/components/ui/RowActions'
import { EmptyState } from '@/components/ui/States'
import { caseSearch, usePatientRecords } from '@/features/patients'
import { cn } from '@/lib/utils/cn'
import { formatIsoDate } from '@/lib/utils/dates'
import { formatWhen } from '@/lib/utils/format-when'
import { recordName, resolutionOf, type BillingException } from '../model/billing-exception'
import { useDeleteException } from '../queries/use-billing-exceptions'
import { ResolveDialog } from './resolve/ResolveDialog'
import { useRecheck } from './use-recheck'

/** The prototype pages its lists 12 at a time. */
export const EXCEPTIONS_PAGE_SIZE = 12

/**
 * The billing exceptions the screen asked the server for (its practice, type
 * and reason), as the prototype lists them: Type, Exception (the reason, with
 * the server's message), Record (the patient, and the case or the visit it
 * sits on) and Detected, sortable, 12 a page. Each row offers:
 * - **Resolve** — the prototype's fix form, when the reason has one; else a
 *   link that opens the record where it is fixed (a case's insurance and
 *   employer on the patient chart, a visit's diagnoses on the visit);
 * - **Re-check** — the server checks the record again now (useful after a
 *   change no save re-checks: a provider, a fee schedule);
 * - **Delete** — after asking: it comes back while the problem is still there.
 *
 * Open rows carry the prototype's marker: red for a charge, amber for the
 * others.
 */
export function ExceptionList({
  exceptions,
  loading,
  failed,
  onRetry,
  filtered,
}: {
  exceptions: readonly BillingException[]
  loading: boolean
  failed: boolean
  onRetry: () => void
  /** A type or reason is chosen: an empty list says nothing matches, not that all is well. */
  filtered: boolean
}) {
  const records = usePatientRecords()
  const recheck = useRecheck()
  const remove = useDeleteException()
  const [page, setPage] = useState(1)
  const [resolving, setResolving] = useState<BillingException | null>(null)
  const [deleting, setDeleting] = useState<BillingException | null>(null)

  const caseName = (exception: BillingException) =>
    records.cases.find((item) => item.id === exception.caseId)?.name ?? ''
  const recordSub = (exception: BillingException): string => {
    if (exception.visitId !== null)
      return exception.visitDate === '' ? 'Visit' : `Visit · DOS ${formatIsoDate(exception.visitDate)}`
    if (exception.caseId !== null) return caseName(exception) === '' ? 'Case' : `Case ${caseName(exception)}`
    return 'Patient record'
  }

  // In the server's order (newest first): it takes no sort.
  const rows = exceptions
  const pageCount = Math.max(1, Math.ceil(rows.length / EXCEPTIONS_PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const pageRows = rows.slice((currentPage - 1) * EXCEPTIONS_PAGE_SIZE, currentPage * EXCEPTIONS_PAGE_SIZE)
  const summary =
    rows.length <= EXCEPTIONS_PAGE_SIZE
      ? `${rows.length} ${rows.length === 1 ? 'exception' : 'exceptions'}`
      : `Showing ${(currentPage - 1) * EXCEPTIONS_PAGE_SIZE + 1}–${Math.min(currentPage * EXCEPTIONS_PAGE_SIZE, rows.length)} of ${rows.length} exceptions`

  const named = (exception: BillingException) => `${exception.trigger} — ${recordName(exception)}`

  /** Resolve, or where to go to fix it. */
  const fixAction = (exception: BillingException) => {
    const resolution = resolutionOf(exception)
    if (resolution.kind === 'form')
      return (
        <Button size="sm" aria-label={`Resolve ${named(exception)}`} onClick={() => setResolving(exception)}>
          Resolve
        </Button>
      )
    if (exception.patientId === null) return null
    if (resolution.place === 'visit' && exception.visitId !== null)
      return (
        <Link
          to="/visits/$visitId"
          params={{ visitId: String(exception.visitId) }}
          aria-label={`Open the visit — ${named(exception)}`}
          className={buttonClass('default', 'sm')}
        >
          Open visit
        </Link>
      )
    return (
      <Link
        to="/patients/$patientId"
        params={{ patientId: exception.patientId }}
        search={exception.caseId === null ? {} : { case: caseSearch(exception.caseId) }}
        aria-label={`Open the ${exception.caseId === null ? 'patient' : 'case'} — ${named(exception)}`}
        className={buttonClass('default', 'sm')}
      >
        {exception.caseId === null ? 'Open patient' : 'Open case'}
      </Link>
    )
  }

  const columns: Array<Column<BillingException>> = [
    {
      key: 'type',
      header: 'Type',
      cell: (exception) => (
        <span className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className={cn(
              'h-5 w-[3px] flex-none rounded-full',
              exception.type === 'charge' ? 'bg-critical' : 'bg-warning',
            )}
          />
          <Tag tone="brand">{exception.level}</Tag>
        </span>
      ),
    },
    {
      key: 'trigger',
      header: 'Exception',
      primary: true,
      cell: (exception) => (
        <span className="block min-w-0">
          <span className="break-words">{exception.trigger}</span>
          {exception.detail !== '' && <CellSub>{exception.detail}</CellSub>}
        </span>
      ),
    },
    {
      key: 'record',
      header: 'Record',
      cell: (exception) => (
        <span className="block min-w-0">
          <span className="text-ink block font-medium break-words">{recordName(exception)}</span>
          <CellSub>
            <span className="break-words">{recordSub(exception)}</span>
          </CellSub>
        </span>
      ),
    },
    {
      key: 'detected',
      header: 'Detected',
      cell: (exception) => (
        <span className="whitespace-nowrap">{formatWhen(exception.detectedAt).label}</span>
      ),
    },
    actionsColumn<BillingException>((exception) => (
      <>
        {fixAction(exception)}
        <RowActionButton
          action="recheck"
          label={`Re-check ${named(exception)}`}
          onClick={() => void recheck(exception)}
        />
        <RowActionButton
          action="delete"
          label={`Delete ${named(exception)}`}
          onClick={() => setDeleting(exception)}
        />
      </>
    )),
  ]

  return (
    <>
      <DataTable
        caption="Billing exceptions"
        columns={columns}
        rows={pageRows}
        getRowId={(exception) => String(exception.id)}
        loading={loading}
        error={failed}
        onRetry={onRetry}
        empty={
          <div className="pt-6">
            {filtered ? (
              <EmptyState icon={<CircleCheck size={20} />} title="No exceptions of this kind" />
            ) : (
              <EmptyState
                icon={<CircleCheck size={20} />}
                title="No billing exceptions"
                description="Records with missing fields, placeholder data or unpriced codes are listed here before their visits can be released."
              />
            )}
          </div>
        }
        footer={
          rows.length > 0 ? (
            <Pagination page={currentPage} pageCount={pageCount} onPageChange={setPage} summary={summary} />
          ) : undefined
        }
      />

      {resolving !== null && <ResolveDialog exception={resolving} onClose={() => setResolving(null)} />}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title="Delete this exception?"
        description="It is taken off the list. It comes back when its record is saved, or its visit released, while the problem is still there."
        confirmLabel="Delete exception"
        tone="destructive"
        onConfirm={async () => {
          if (deleting === null) return
          try {
            const message = await remove.mutateAsync(deleting.id)
            toast.success(message ?? 'Exception deleted')
          } catch (error) {
            toast.error(
              'The exception was not deleted',
              isApiError(error) ? userMessage(error) : 'Something went wrong. Please try again.',
            )
          }
        }}
      />
    </>
  )
}
