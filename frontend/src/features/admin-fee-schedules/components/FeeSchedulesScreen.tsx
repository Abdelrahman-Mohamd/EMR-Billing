import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { CheckCircle2, Circle, DollarSign, Plus } from 'lucide-react'
import { isApiError, userMessage } from '@/lib/api/api-error'
import { formatIsoDate } from '@/lib/utils/dates'
import { formatMoney } from '@/lib/utils/money'
import { toast } from '@/stores/toast-store'
import { Button, buttonClass } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { CellSub, DataTable, type Column, type Sort } from '@/components/ui/DataTable'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { Field } from '@/components/ui/Field'
import { Pagination } from '@/components/ui/Pagination'
import { RowActionButton, actionsColumn } from '@/components/ui/RowActions'
import { SearchSelect } from '@/components/ui/SearchSelect'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { PageContainer, PageHeader } from '@/components/shared/PageLayout'
import { insuranceLabel, useInsurances } from '@/features/admin-insurances'
import { usePractices } from '@/features/admin-practices'
import { useProcedureCodes } from '@/features/admin-procedure-codes'
import { useDeleteFeeRow, useFeeSchedules } from '../queries/use-fee-schedules'
import type { FeeRow } from '../schemas/fee-row'
import { FeeRowDialog } from './FeeRowDialog'
import { PriceLookup } from './PriceLookup'

/** The prototype pages an insurance's rows 15 at a time. */
const PAGE_SIZE = 15

/**
 * Setup → Fee schedules, as the prototype has it: pick an insurance and see
 * its fee rows — code, billed per unit, the code's default fee for comparison,
 * the dates it is in effect (or no end date) — each with Edit and Delete; "Add
 * fee row"; and, beside the list, the Price lookup. Before there is an
 * insurance and a procedure code to price, it says what is needed instead.
 *
 * Every row is read (all of the server's pages) and shown one insurance at a
 * time, sorted and paged here as the prototype does. A row comes with its
 * code's text, description and default fee. The insurances come from the
 * insurances list, the codes for a new row from the procedure codes list —
 * both through their own features.
 *
 * The chosen insurance is kept in the URL (`?insurance=<id>`, an opaque id).
 * With none chosen, the first insurance is shown, as the prototype does.
 */
/** A row as an action names it: its code, and its start when the code is priced more than once. */
const rowName = (row: FeeRow) => `${row.procedureCode} (from ${formatIsoDate(row.from)})`

export function FeeSchedulesScreen({ insuranceFilter }: { insuranceFilter: number | undefined }) {
  const navigate = useNavigate()
  const insurances = useInsurances()
  const practices = usePractices()
  const procedureCodes = useProcedureCodes()
  const fees = useFeeSchedules()
  const remove = useDeleteFeeRow()
  /** `undefined`: no dialog. `null`: adding. A row: editing it. */
  const [editing, setEditing] = useState<FeeRow | null | undefined>(undefined)
  const [deleting, setDeleting] = useState<FeeRow | null>(null)
  const [sort, setSort] = useState<Sort>({ key: 'code', direction: 'asc' })
  const [page, setPage] = useState(1)

  const practiceName = (id: number) => practices.data?.find((practice) => practice.id === id)?.name
  const payers = [...(insurances.data ?? [])].sort((a, b) => a.practiceId - b.practiceId || a.code - b.code)
  const insurance = payers.find((payer) => payer.id === insuranceFilter) ?? payers[0]
  const codes = procedureCodes.data ?? []
  const loading = insurances.isPending || procedureCodes.isPending || fees.isPending
  const canPrice = payers.length > 0 && codes.length > 0

  const choose = (value: string | null) => {
    setPage(1)
    void navigate({
      to: '/setup/fee-schedules',
      search: value === null ? {} : { insurance: Number(value) },
      replace: true,
    })
  }

  const rows: FeeRow[] = (insurance === undefined ? [] : (fees.data ?? []))
    .filter((row) => row.insuranceId === insurance?.id)
    .sort((a, b) => {
      const order =
        sort.key === 'billed'
          ? a.billed - b.billed
          : a.procedureCode.localeCompare(b.procedureCode) || a.from.localeCompare(b.from)
      return sort.direction === 'asc' ? order : -order
    })
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const pageRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const summary =
    rows.length <= PAGE_SIZE
      ? `${rows.length} ${rows.length === 1 ? 'fee row' : 'fee rows'}`
      : `Showing ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, rows.length)} of ${rows.length} fee rows`

  const columns: ReadonlyArray<Column<FeeRow>> = [
    {
      key: 'code',
      header: 'Code',
      primary: true,
      sortable: true,
      cell: (row) => (
        // Room for a description to wrap between words beside the other columns.
        <span className="block xl:min-w-32">
          <span className="font-medium whitespace-nowrap">{row.procedureCode}</span>
          <CellSub>
            <span className="break-words">{row.description}</span>
          </CellSub>
        </span>
      ),
    },
    {
      key: 'billed',
      header: 'Billed / unit',
      sortable: true,
      cell: (row) => (
        <span className="text-ink font-medium whitespace-nowrap tabular-nums">{formatMoney(row.billed)}</span>
      ),
    },
    {
      key: 'default',
      header: 'Default fee',
      cell: (row) => (
        <span className="text-n500 whitespace-nowrap tabular-nums">{formatMoney(row.defaultFee)}</span>
      ),
    },
    {
      key: 'effective',
      header: 'Effective',
      cell: (row) => (
        // Each date stays whole; the range may wrap between them.
        <span>
          <span className="whitespace-nowrap">{formatIsoDate(row.from)} –</span>{' '}
          <span className="whitespace-nowrap">{row.to === null ? 'no end date' : formatIsoDate(row.to)}</span>
        </span>
      ),
    },
    actionsColumn<FeeRow>((row) => (
      <>
        <RowActionButton
          action="edit"
          label={`Edit the ${rowName(row)} row`}
          onClick={() => setEditing(row)}
        />
        <RowActionButton
          action="delete"
          label={`Delete the ${rowName(row)} row`}
          onClick={() => setDeleting(row)}
        />
      </>
    )),
  ]

  const insuranceOptions = payers.map((payer) => ({
    id: payer.id,
    name: payer.name,
    label: insuranceLabel(payer),
    ...(practiceName(payer.practiceId) === undefined ? {} : { description: practiceName(payer.practiceId) }),
  }))

  const body = () => {
    if (insurances.isError || fees.isError) {
      return (
        <ErrorState
          onRetry={() => {
            if (insurances.isError) void insurances.refetch()
            if (fees.isError) void fees.refetch()
          }}
        />
      )
    }
    if (!loading && !canPrice) {
      return (
        <div className="grid gap-4">
          <Card>
            <EmptyState
              icon={<DollarSign size={20} />}
              title="Nothing to price yet"
              description="A fee-schedule row is the billed price of one procedure code for one insurance. Without a row, a charge uses the code’s default fee."
            />
          </Card>
          <Card>
            <CardHeader title="A fee schedule needs" />
            <CardBody>
              <ul className="grid gap-3">
                {[
                  {
                    ok: payers.length > 0,
                    label: 'At least one insurance',
                    why: 'Every insurance needs an insurance class first.',
                    action: { label: 'Add an insurance', to: '/setup/insurances' as const },
                  },
                  {
                    ok: codes.length > 0,
                    label: 'At least one procedure code',
                    why: 'Shared CPT / HCPCS reference data.',
                    action: { label: 'Add a procedure code', to: '/setup/procedure-codes' as const },
                  },
                ].map((need) => (
                  <li key={need.label} className="flex flex-wrap items-start gap-3">
                    {need.ok ? (
                      <CheckCircle2 size={18} className="text-success mt-0.5 flex-none" aria-hidden="true" />
                    ) : (
                      <Circle size={18} className="text-n400 mt-0.5 flex-none" aria-hidden="true" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="text-meta text-ink block font-medium">
                        {need.label}
                        <span className="sr-only">{need.ok ? ' — done' : ' — still needed'}</span>
                      </span>
                      <span className="text-micro text-n500 block">{need.why}</span>
                    </span>
                    {!need.ok && (
                      <Link to={need.action.to} className={buttonClass('default', 'sm')}>
                        {need.action.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>
      )
    }
    return (
      <div className="grid items-start gap-6 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <Field label="Insurance" className="mb-4 max-w-sm">
            <SearchSelect
              value={insurance === undefined ? null : String(insurance.id)}
              onChange={choose}
              options={insuranceOptions.map((option) => ({
                value: String(option.id),
                label: option.label,
                ...(option.description === undefined ? {} : { description: option.description }),
              }))}
              placeholder="Select an insurance"
              searchPlaceholder="Search insurances"
              disabled={loading}
            />
          </Field>
          <DataTable
            caption={insurance === undefined ? 'Fee rows' : `Fee rows for ${insurance.name}`}
            columns={columns}
            rows={pageRows}
            getRowId={(row) => String(row.id)}
            loading={loading}
            sort={sort}
            onSortChange={(next) => {
              setSort(next)
              setPage(1)
            }}
            empty={
              <EmptyState
                icon={<DollarSign size={20} />}
                title={`No fee schedule for ${insurance?.name ?? 'this insurance'}`}
                description="Every code falls back to its default fee."
              />
            }
            footer={
              rows.length > 0 ? (
                <Pagination
                  page={currentPage}
                  pageCount={pageCount}
                  onPageChange={setPage}
                  summary={summary}
                />
              ) : undefined
            }
          />
        </div>
        {!loading && (
          <PriceLookup
            insurances={insuranceOptions}
            codes={codes}
            rows={fees.data}
            initialInsuranceId={insurance?.id ?? null}
          />
        )}
      </div>
    )
  }

  return (
    <PageContainer>
      <PageHeader
        title="Fee schedules"
        description="Set the billed price per unit of a code for an insurance. Without one, a charge uses the code’s default fee."
        {...(canPrice && insurance !== undefined
          ? {
              actions: (
                <Button
                  variant="primary"
                  icon={<Plus size={16} aria-hidden="true" />}
                  onClick={() => setEditing(null)}
                >
                  Add fee row
                </Button>
              ),
            }
          : {})}
      />

      {body()}

      {editing !== undefined && insurance !== undefined && (
        <FeeRowDialog
          key={editing?.id ?? 'new'}
          insuranceId={insurance.id}
          insuranceName={insurance.name}
          row={editing}
          codes={codes}
          onClose={() => setEditing(undefined)}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title={`Delete the ${deleting === null ? '' : rowName(deleting)} row?`}
        description="The code falls back to its default fee for this payer."
        confirmLabel="Delete row"
        tone="destructive"
        onConfirm={async () => {
          if (deleting === null) return
          try {
            const message = await remove.mutateAsync(deleting.id)
            toast.success(message ?? 'Fee row deleted')
          } catch (error) {
            toast.error(
              'The fee row was not deleted',
              isApiError(error) ? userMessage(error) : 'Something went wrong. Please try again.',
            )
          }
        }}
      />
    </PageContainer>
  )
}
