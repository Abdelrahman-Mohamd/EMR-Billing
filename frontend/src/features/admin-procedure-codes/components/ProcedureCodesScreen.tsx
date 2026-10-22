import { useState } from 'react'
import { Hash, Plus } from 'lucide-react'
import { isApiError, userMessage } from '@/lib/api/api-error'
import { toast } from '@/stores/toast-store'
import { StatusDot, Tag } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { CellSub, DataTable, type Column } from '@/components/ui/DataTable'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { Pagination } from '@/components/ui/Pagination'
import { RowActionButton, actionsColumn, StatusChangeDialog, activeColumn } from '@/components/ui/RowActions'
import { EmptyState } from '@/components/ui/States'
import { PageContainer, PageHeader } from '@/components/shared/PageLayout'
import { formatMoney } from '@/lib/utils/money'
import { procedureTypeName } from '../model/procedure-code'
import {
  useDeleteProcedureCode,
  useProcedureCodes,
  useSetProcedureCodeActive,
} from '../queries/use-procedure-codes'
import type { ProcedureCode } from '../schemas/procedure-code'
import { ProcedureCodeDialog } from './ProcedureCodeDialog'

/** The prototype pages the list 20 codes at a time. */
const PAGE_SIZE = 20

/**
 * Setup → Procedure codes, as the prototype has it: one list shared by every
 * practice — code, description, type, timed, modifier override, default fee
 * (marked at $0.00), Active (asks first) — sorted by code, 20 a page; Edit and
 * Delete; and "New code". No search or filter: the prototype has none. The
 * prototype's "New from EMR" mark is not in the contract, so it is left out.
 *
 * Every code is read (all of the server's pages — fee schedules, coding rules
 * and visits pick from the same list) and sorted and paged here.
 *
 * Not built: the prototype limits editing to a System Admin; there is no
 * permission model here yet (docs/FRONTEND_ARCHITECTURE.md §8).
 */
export function ProcedureCodesScreen() {
  const procedureCodes = useProcedureCodes()
  const codes = procedureCodes.data ?? []
  const setActive = useSetProcedureCodeActive()
  const remove = useDeleteProcedureCode()
  /** `undefined`: no dialog. `null`: adding. A code: editing it. */
  const [editing, setEditing] = useState<ProcedureCode | null | undefined>(undefined)
  /** The row whose Active switch was flipped, waiting for confirmation. */
  const [statusOf, setStatusOf] = useState<ProcedureCode | null>(null)
  const [deleting, setDeleting] = useState<ProcedureCode | null>(null)
  const [page, setPage] = useState(1)

  // In the server's order: it takes no sort.
  const sorted = codes
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const rows = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const first = (currentPage - 1) * PAGE_SIZE + 1
  const last = Math.min(currentPage * PAGE_SIZE, sorted.length)
  const summary =
    sorted.length <= PAGE_SIZE
      ? `${sorted.length} ${sorted.length === 1 ? 'code' : 'codes'}`
      : `Showing ${first}–${last} of ${sorted.length} codes`

  const fee = (code: ProcedureCode) =>
    code.defaultFee > 0 ? (
      <span className="whitespace-nowrap tabular-nums">{formatMoney(code.defaultFee)}</span>
    ) : (
      <StatusDot tone="critical">{formatMoney(0)}</StatusDot>
    )
  const override = (code: ProcedureCode) =>
    code.modifierOverride && code.modifiers.length > 0 ? (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <Tag>On</Tag>
        <span className="text-ink font-medium whitespace-nowrap">{code.modifiers.join(' · ')}</span>
      </span>
    ) : (
      <span className="text-n500">Off</span>
    )

  const columns: ReadonlyArray<Column<ProcedureCode>> = [
    {
      key: 'code',
      header: 'Code',
      primary: true,
      cell: (code) => <span className="font-medium whitespace-nowrap">{code.code}</span>,
    },
    {
      key: 'description',
      header: 'Description',
      cell: (code) => <span className="break-words">{code.description}</span>,
    },
    {
      // The prototype's Type and "Timed (8-minute rule)" columns, as one: there
      // is no room for both beside the override below 1440px.
      key: 'procedureType',
      header: 'Type',
      cell: (code) => (
        <span className="block whitespace-nowrap">
          {procedureTypeName(code)}
          <CellSub>{code.isTimed ? 'Timed (8-minute rule)' : 'Untimed'}</CellSub>
        </span>
      ),
    },
    { key: 'modifiers', header: 'Modifier override', cell: override },
    {
      key: 'defaultFee',
      header: 'Default fee',
      cell: fee,
    },
    activeColumn<ProcedureCode>({
      isActive: (code) => code.isActive,
      label: (code) => `${code.code} — ${code.description}`,
      // Asks first (StatusChangeDialog below).
      onChange: (code) => setStatusOf(code),
    }),
    actionsColumn<ProcedureCode>((code) => (
      <>
        <RowActionButton
          action="edit"
          label={`Edit ${code.code} — ${code.description}`}
          onClick={() => setEditing(code)}
        />
        <RowActionButton
          action="delete"
          label={`Delete ${code.code} — ${code.description}`}
          onClick={() => setDeleting(code)}
        />
      </>
    )),
  ]

  const newButton = (
    <Button variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => setEditing(null)}>
      New code
    </Button>
  )

  return (
    <PageContainer>
      <PageHeader
        title="Procedure codes"
        description="Add and manage the CPT / HCPCS codes every practice bills, with their default fee and optional override modifiers."
        actions={newButton}
      />

      <DataTable
        caption="Procedure codes"
        columns={columns}
        rows={rows}
        getRowId={(code) => String(code.id)}
        loading={procedureCodes.isPending}
        error={procedureCodes.isError}
        onRetry={() => void procedureCodes.refetch()}
        empty={
          <EmptyState
            icon={<Hash size={20} />}
            title="No procedure codes yet"
            description="Each charge line is one CPT / HCPCS code with a default fee. The list is shared by every practice."
            action={
              <Button
                variant="primary"
                icon={<Plus size={16} aria-hidden="true" />}
                onClick={() => setEditing(null)}
              >
                Add a procedure code
              </Button>
            }
          />
        }
        footer={
          sorted.length > 0 ? (
            <Pagination page={currentPage} pageCount={pageCount} onPageChange={setPage} summary={summary} />
          ) : undefined
        }
      />

      {editing !== undefined && (
        <ProcedureCodeDialog
          key={editing?.id ?? 'new'}
          procedureCode={editing}
          onClose={() => setEditing(undefined)}
        />
      )}
      {statusOf !== null && (
        <StatusChangeDialog
          name={statusOf.code}
          isActive={statusOf.isActive}
          onConfirm={() => setActive.mutateAsync({ id: statusOf.id, isActive: !statusOf.isActive })}
          onClose={() => setStatusOf(null)}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title={`Delete ${deleting?.code ?? ''}?`}
        description="Its fee-schedule prices are deleted too."
        confirmLabel="Delete code"
        tone="destructive"
        onConfirm={async () => {
          if (deleting === null) return
          try {
            const message = await remove.mutateAsync(deleting.id)
            toast.success(message ?? `${deleting.code} deleted`)
          } catch (error) {
            toast.error(
              `${deleting.code} was not deleted`,
              isApiError(error) ? userMessage(error) : 'Something went wrong. Please try again.',
            )
          }
        }}
      />
    </PageContainer>
  )
}
