import { useState } from 'react'
import { Hash, Plus } from 'lucide-react'
import { Badge, StatusDot, Tag } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { CellSub, DataTable, type Column, type Sort } from '@/components/ui/DataTable'
import { Pagination } from '@/components/ui/Pagination'
import { RowActionButton, actionsColumn, activeColumn } from '@/components/ui/RowActions'
import { EmptyState } from '@/components/ui/States'
import { PageContainer, PageHeader } from '@/components/shared/PageLayout'
import { useProcedureCodes } from '../data/procedure-code-store'
import { formatMoney } from '@/lib/utils/money'
import type { ProcedureCode } from '../model/procedure-code'
import { ProcedureCodeDialog } from './ProcedureCodeDialog'

/** The prototype pages the list 20 codes at a time. */
const PAGE_SIZE = 20

/**
 * Setup → Procedure codes, as the prototype has it: one list shared by every
 * practice — code (marked when new from the EMR), description, type, timed,
 * modifier override, default fee (marked at $0.00), status — sorted by code,
 * 20 a page, each row opening the code to edit; and "New code". No search,
 * filter or delete: the prototype has none.
 *
 * **Frontend only.** There is no backend for procedure codes: the list lives
 * in this browser tab (`data/procedure-code-store.ts`). That is architecture, not
 * product: the screen shows no message about it.
 *
 * Not built: the prototype limits editing to a System Admin; there is no
 * permission model here yet (docs/FRONTEND_ARCHITECTURE.md §8).
 */
export function ProcedureCodesScreen() {
  const { ready, codes, save } = useProcedureCodes()
  /** `undefined`: no dialog. `null`: adding. A code: editing it. */
  const [editing, setEditing] = useState<ProcedureCode | null | undefined>(undefined)
  const [sort, setSort] = useState<Sort>({ key: 'code', direction: 'asc' })
  const [page, setPage] = useState(1)

  const compare = (a: ProcedureCode, b: ProcedureCode) => {
    if (sort.key === 'defaultFee') return a.defaultFee - b.defaultFee
    const text = (left: string, right: string) =>
      left.localeCompare(right, undefined, { sensitivity: 'base' })
    if (sort.key === 'description') return text(a.description, b.description)
    if (sort.key === 'procedureType') return text(a.procedureType, b.procedureType)
    return text(a.code, b.code)
  }
  const sorted = [...codes].sort((a, b) => (sort.direction === 'asc' ? compare(a, b) : -compare(a, b)))
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
      sortable: true,
      cell: (code) => (
        <span className="block">
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <span className="font-medium whitespace-nowrap">{code.code}</span>
            {code.isNewFromEmr && <Badge tone="warning">New from EMR</Badge>}
          </span>
          {/* On a phone, where their columns are hidden, the description and fee ride under the code. */}
          <span className="sm:hidden">
            <CellSub>
              <span className="[overflow-wrap:anywhere]">{code.description}</span>
              <span aria-hidden="true"> · </span>
              {code.defaultFee > 0 ? formatMoney(code.defaultFee) : `${formatMoney(0)} fee`}
            </CellSub>
          </span>
          {/* Until the type and override columns appear, they ride under the code. */}
          <span className="xl:hidden">
            <CellSub>
              {code.procedureType}
              <span aria-hidden="true"> · </span>
              {code.isTimed ? 'Timed' : 'Untimed'}
              {code.modifierOverride && code.modifiers.length > 0 && (
                <>
                  <span aria-hidden="true"> · </span>
                  Override {code.modifiers.join(' · ')}
                </>
              )}
            </CellSub>
          </span>
        </span>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      sortable: true,
      hideOnMobile: true,
      cell: (code) => <span className="[overflow-wrap:anywhere]">{code.description}</span>,
    },
    {
      // The prototype's Type and "Timed (8-minute rule)" columns, as one: there
      // is no room for both beside the override below 1440px.
      key: 'procedureType',
      header: 'Type',
      sortable: true,
      hideBelow: 'xl',
      cell: (code) => (
        <span className="block whitespace-nowrap">
          {code.procedureType}
          <CellSub>{code.isTimed ? 'Timed (8-minute rule)' : 'Untimed'}</CellSub>
        </span>
      ),
    },
    { key: 'modifiers', header: 'Modifier override', hideBelow: 'xl', cell: override },
    {
      key: 'defaultFee',
      header: 'Default fee',
      sortable: true,
      hideOnMobile: true,
      cell: fee,
    },
    activeColumn<ProcedureCode>({
      isActive: (code) => code.isActive,
      label: (code) => `${code.code} — ${code.description}`,
      // Only the flag changes; everything else about the code stays as it is.
      onChange: (code, isActive) => save({ ...code, isActive }),
    }),
    actionsColumn<ProcedureCode>((code) => (
      <RowActionButton
        action="edit"
        label={`Edit ${code.code} — ${code.description}`}
        onClick={() => setEditing(code)}
      />
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
        getRowId={(code) => code.code}
        loading={!ready}
        sort={sort}
        onSortChange={(next) => {
          setSort(next)
          setPage(1)
        }}
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
          key={editing?.code ?? 'new'}
          procedureCode={editing}
          existingCodes={codes.map((code) => code.code)}
          onSave={save}
          onClose={() => setEditing(undefined)}
        />
      )}
    </PageContainer>
  )
}
