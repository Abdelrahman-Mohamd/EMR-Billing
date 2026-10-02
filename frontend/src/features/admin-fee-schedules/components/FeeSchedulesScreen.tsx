import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { CheckCircle2, Circle, DollarSign, Plus } from 'lucide-react'
import { formatIsoDate } from '@/lib/utils/dates'
import { formatMoney } from '@/lib/utils/money'
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
import { useProcedureCodes, type ProcedureCode } from '@/features/admin-procedure-codes'
import { useFeeSchedules } from '../data/fee-schedule-store'
import type { FeeRow } from '../model/fee-row'
import { FeeRowDialog } from './FeeRowDialog'
import { PriceLookup } from './PriceLookup'

/** The prototype pages an insurance's rows 15 at a time. */
const PAGE_SIZE = 15

interface Row extends FeeRow {
  /** The code's record, when the procedure codes list still has it. */
  code: ProcedureCode | undefined
}

/**
 * Setup → Fee schedules, as the prototype has it: pick an insurance and see
 * its fee rows — code, billed per unit, the code's default fee for comparison,
 * the dates it is in effect — each with Edit and Delete; "Add fee row"; and,
 * beside the list, the Price lookup. Before there is an insurance and a
 * procedure code to price, it says what is needed instead.
 *
 * **Frontend only.** There is no backend for fee schedules: the rows live in
 * this browser tab (`data/fee-schedule-store.ts`); the screen shows no message
 * about it. The
 * insurances come from the insurances list, the codes from the procedure codes
 * list — both through their own features.
 *
 * The chosen insurance is kept in the URL (`?insurance=<id>`, an opaque id).
 * With none chosen, the first insurance is shown, as the prototype does.
 */
export function FeeSchedulesScreen({ insuranceFilter }: { insuranceFilter: number | undefined }) {
  const navigate = useNavigate()
  const insurances = useInsurances()
  const practices = usePractices()
  const procedureCodes = useProcedureCodes()
  const fees = useFeeSchedules()
  /** `undefined`: no dialog. `null`: adding. A row: editing it. */
  const [editing, setEditing] = useState<FeeRow | null | undefined>(undefined)
  const [deleting, setDeleting] = useState<FeeRow | null>(null)
  const [sort, setSort] = useState<Sort>({ key: 'code', direction: 'asc' })
  const [page, setPage] = useState(1)

  const practiceName = (id: number) => practices.data?.find((practice) => practice.id === id)?.name
  const payers = [...(insurances.data ?? [])].sort((a, b) => a.practiceId - b.practiceId || a.code - b.code)
  const insurance = payers.find((payer) => payer.id === insuranceFilter) ?? payers[0]
  const codes = procedureCodes.codes
  const loading = insurances.isPending || !procedureCodes.ready || !fees.ready
  const canPrice = payers.length > 0 && codes.length > 0

  const choose = (value: string | null) => {
    setPage(1)
    void navigate({
      to: '/setup/fee-schedules',
      search: value === null ? {} : { insurance: Number(value) },
      replace: true,
    })
  }

  const rows: Row[] = (insurance === undefined ? [] : fees.rows)
    .filter((row) => row.insuranceId === insurance?.id)
    .map((row) => ({ ...row, code: codes.find((code) => code.code === row.procedureCode) }))
    .sort((a, b) => {
      const order =
        sort.key === 'billed' ? a.billed - b.billed : a.procedureCode.localeCompare(b.procedureCode)
      return sort.direction === 'asc' ? order : -order
    })
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const pageRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const summary =
    rows.length <= PAGE_SIZE
      ? `${rows.length} ${rows.length === 1 ? 'fee row' : 'fee rows'}`
      : `Showing ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, rows.length)} of ${rows.length} fee rows`

  const columns: ReadonlyArray<Column<Row>> = [
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
            <span className="break-words">{row.code?.description ?? 'Not in the procedure codes list'}</span>
          </CellSub>
          {/* Until their columns appear, the default fee and dates ride under the code. */}
          <span className="md:hidden">
            <CellSub>
              {formatIsoDate(row.from)} – {formatIsoDate(row.to)}
            </CellSub>
          </span>
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
      hideOnMobile: true,
      cell: (row) => (
        <span className="text-n500 whitespace-nowrap tabular-nums">
          {row.code === undefined ? '—' : formatMoney(row.code.defaultFee)}
        </span>
      ),
    },
    {
      key: 'effective',
      header: 'Effective',
      hideBelow: 'md',
      cell: (row) => (
        // Each date stays whole; the range may wrap between them.
        <span>
          <span className="whitespace-nowrap">{formatIsoDate(row.from)} –</span>{' '}
          <span className="whitespace-nowrap">{formatIsoDate(row.to)}</span>
        </span>
      ),
    },
    actionsColumn<Row>((row) => (
      <>
        <RowActionButton
          action="edit"
          label={`Edit the ${row.procedureCode} row`}
          onClick={() => setEditing(row)}
        />
        <RowActionButton
          action="delete"
          label={`Delete the ${row.procedureCode} row`}
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
    if (insurances.isError) {
      return <ErrorState onRetry={() => void insurances.refetch()} />
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
            getRowId={(row) => row.procedureCode}
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
            rows={fees.rows}
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
          key={editing?.procedureCode ?? 'new'}
          insuranceId={insurance.id}
          insuranceName={insurance.name}
          row={editing}
          codes={codes}
          takenCodes={rows.map((row) => row.procedureCode)}
          onSave={fees.save}
          onClose={() => setEditing(undefined)}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title={`Delete the ${deleting?.procedureCode ?? ''} row?`}
        description="The code falls back to its default fee for this payer."
        confirmLabel="Delete row"
        tone="destructive"
        onConfirm={() => {
          if (deleting !== null) fees.remove(deleting)
          setDeleting(null)
        }}
      />
    </PageContainer>
  )
}
