import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, FileText, Pencil, Plus, Send, Trash2 } from 'lucide-react'
import { toast } from '@/stores/toast-store'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { CellSub, DataTable, type Column } from '@/components/ui/DataTable'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { CardEmpty, CardGroup, DetailCard } from '@/components/ui/DetailCard'
import { KeyValue } from '@/components/ui/KeyValue'
import { RowActionButton, RowActions, actionsColumn } from '@/components/ui/RowActions'
import { Notice } from '@/components/ui/Notice'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { PageContainer, PageHeader } from '@/components/shared/PageLayout'
import { caseSearch } from '@/features/patients'
import { isApiError, userMessage } from '@/lib/api/api-error'
import { formatIsoDate } from '@/lib/utils/dates'
import { amountText, modifiersText, pointersText } from '../model/charge-line-text'
import { isReleased, visitStatus } from '../model/visit-status'
import { useVisitReferences } from '../queries/use-visit-references'
import { useDeleteChargeLine, useDeleteVisit, useReleaseVisit, useVisit } from '../queries/use-visits'
import type { ChargeLine, Visit } from '../schemas/visit'
import { ChargeLineDialog } from './ChargeLineDialog'
import { EditVisitDialog } from './EditVisitDialog'

const backLink = (
  <Link
    to="/visits"
    className="text-micro text-brand-deep hover:text-ink relative inline-flex items-center gap-1.5 font-medium no-underline after:absolute after:-inset-x-1 after:-inset-y-2.5 after:content-['']"
  >
    <ArrowLeft size={14} aria-hidden="true" />
    Visits
  </Link>
)

/**
 * One visit, as the server reads it on its own: who and when (the patient and
 * case — with a way back to the chart — the date of service, location with its
 * place of service, billing and treating providers, the authorization), its
 * status and, when pended, the server's reason; its charge lines with their
 * amounts; then what the route places under it: the visit's claims (`claims`,
 * from Claims — kept out of this feature so each depends one way only).
 *
 * Until it is released: Release (the server sends it to be claimed, or pends
 * it and says why), Edit visit (its own fields) and Delete visit, and its
 * lines' Add charge line, Edit and Delete (contract 2026-10-09). A released
 * visit and its lines can no longer change, so none is offered.
 */
export function VisitDetail({ visitId, claims }: { visitId: number; claims?: (visit: Visit) => ReactNode }) {
  const navigate = useNavigate()
  const query = useVisit(visitId)
  const refs = useVisitReferences()
  const release = useReleaseVisit()
  const remove = useDeleteVisit()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  /** `undefined`: no dialog. `null`: adding a line. A line: editing it. */
  const [editingLine, setEditingLine] = useState<ChargeLine | null | undefined>(undefined)
  const [deletingLine, setDeletingLine] = useState<ChargeLine | null>(null)
  const removeLine = useDeleteChargeLine()

  if (query.isPending) return <PageContainer>{null}</PageContainer>
  if (query.isError) {
    if (isApiError(query.error) && query.error.kind === 'not_found')
      return (
        <PageContainer>
          <div className="pt-8">
            <EmptyState
              icon={<FileText size={20} />}
              title="Visit not found"
              description="It may have been deleted."
              action={
                <Link to="/visits" className="text-brand-deep font-medium">
                  Back to visits
                </Link>
              }
            />
          </div>
        </PageContainer>
      )
    return (
      <PageContainer>
        <PageHeader title="Visit" above={backLink} />
        <ErrorState onRetry={() => void query.refetch()} />
      </PageContainer>
    )
  }

  const visit = query.data
  const status = visitStatus(visit.status)
  const released = isReleased(visit)
  const provider = (named: Visit['billingProvider'], id: number) =>
    named === null
      ? { value: refs.providerName(id) }
      : { value: named.name, ...(named.npi === '' ? {} : { sub: `NPI ${named.npi}` }) }
  const procedureOf = (line: ChargeLine) =>
    line.procedureCode === ''
      ? refs.procedure(line.procedureCodeId)
      : { code: line.procedureCode, description: line.procedureDescription }

  // "2 (98110)": its place on the visit, then its code — two lines may share a code.
  const lineName = (line: ChargeLine) => `${visit.chargeLines.indexOf(line) + 1} (${procedureOf(line).code})`

  const columns: ReadonlyArray<Column<ChargeLine>> = [
    {
      key: 'code',
      header: 'Procedure',
      primary: true,
      cell: (line) => {
        const procedure = procedureOf(line)
        return (
          <span className="block min-w-0">
            <span className="tabular-nums">{procedure.code}</span>
            {procedure.description !== '' && <CellSub>{procedure.description}</CellSub>}
            {line.originalProcedureCodeId !== null && (
              <CellSub>Replaced {refs.procedure(line.originalProcedureCodeId).code} by a coding rule</CellSub>
            )}
            {line.notes !== '' && (
              <CellSub>
                <span className="break-words whitespace-pre-line">Note: {line.notes}</span>
              </CellSub>
            )}
          </span>
        )
      },
    },
    { key: 'units', header: 'Units', cell: (line) => <span className="tabular-nums">{line.units}</span> },
    {
      key: 'modifiers',
      header: 'Modifiers',
      cell: (line) => modifiersText(line) || <span className="text-n400">—</span>,
    },
    {
      key: 'pointers',
      header: 'Diagnosis pointers',
      cell: (line) => pointersText(line, visit.diagnosisCodes) || <span className="text-n400">—</span>,
    },
    {
      key: 'pos',
      header: 'Place of service',
      cell: (line) => <span className="tabular-nums">{line.placeOfService || '—'}</span>,
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      cell: (line) => <span className="tabular-nums">{amountText(line.amount) || '—'}</span>,
    },
    // A released visit's lines are frozen: no actions.
    ...(released
      ? []
      : [
          actionsColumn<ChargeLine>((line) => (
            <RowActions>
              <RowActionButton
                action="edit"
                label={`Edit charge line ${lineName(line)}`}
                onClick={() => setEditingLine(line)}
              />
              <RowActionButton
                action="delete"
                label={`Delete charge line ${lineName(line)}`}
                onClick={() => setDeletingLine(line)}
              />
            </RowActions>
          )),
        ]),
  ]

  const doRelease = async () => {
    try {
      const result = await release.mutateAsync(visit.id)
      // Pended is an answer, not a failure: the server says why.
      if (result.visit.status === 'pended')
        toast.warning('The visit was pended', result.visit.pendReason || result.message || undefined)
      else toast.success(result.message ?? 'Visit released')
    } catch (error) {
      toast.error(
        'The visit was not released',
        isApiError(error) ? userMessage(error) : 'Something went wrong. Please try again.',
      )
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title={`${refs.patientFullName(visit)} · ${formatIsoDate(visit.dateOfService)}`}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Badge tone={status.tone}>{status.label}</Badge>
            <span>{visit.caseName}</span>
            {visit.patientId !== '' && (
              <>
                <span aria-hidden="true">·</span>
                <Link
                  to="/patients/$patientId"
                  params={{ patientId: visit.patientId }}
                  search={{ case: caseSearch(visit.caseId) }}
                  hash="case"
                  // An invisible hit box around the short link, as the back links have.
                  className="text-brand-deep relative font-medium after:absolute after:-inset-x-1 after:-inset-y-2.5 after:content-['']"
                >
                  Open chart
                </Link>
              </>
            )}
          </span>
        }
        above={backLink}
        {...(released
          ? {}
          : {
              actions: (
                <>
                  <Button icon={<Pencil size={16} aria-hidden="true" />} onClick={() => setEditing(true)}>
                    Edit visit
                  </Button>
                  <Button
                    variant="danger"
                    icon={<Trash2 size={16} aria-hidden="true" />}
                    onClick={() => setDeleting(true)}
                  >
                    Delete visit
                  </Button>
                  <Button
                    variant="primary"
                    icon={<Send size={16} aria-hidden="true" />}
                    loading={release.isPending}
                    onClick={() => void doRelease()}
                  >
                    Release visit
                  </Button>
                </>
              ),
            })}
      />

      {visit.status === 'pended' && visit.pendReason !== '' && (
        <Notice tone="warning" title="Pended" className="mb-4">
          {visit.pendReason}
        </Notice>
      )}

      {/* The visit, then its lines, then its claims: a card each, as on the
          patient chart (user, 2026-10-09). */}
      <DetailCard title="Visit details">
        {/* Three groups side by side where the card is wide enough, else two, else one. */}
        <div className="@container">
          <div className="grid gap-y-7 pt-4 @xl:grid-cols-2 @xl:gap-x-10 @4xl:grid-cols-3 @4xl:gap-x-8">
            <CardGroup title="Visit">
              <KeyValue
                layout="rows"
                items={[
                  { label: 'Patient', value: refs.patientFullName(visit) },
                  { label: 'Case', value: visit.caseName },
                  { label: 'Date of service', value: formatIsoDate(visit.dateOfService) },
                  { label: 'Source', value: visit.source === 'manual' ? 'Entered here' : visit.source },
                ]}
              />
            </CardGroup>
            <CardGroup title="Location & providers">
              <KeyValue
                layout="rows"
                items={[
                  {
                    label: 'Location',
                    value: visit.locationName,
                    ...(visit.placeOfService === ''
                      ? {}
                      : { sub: `Place of service ${visit.placeOfService}` }),
                  },
                  { label: 'Billing provider', ...provider(visit.billingProvider, visit.billingProviderId) },
                  {
                    label: 'Treating provider',
                    ...provider(visit.treatingProvider, visit.treatingProviderId),
                  },
                ]}
              />
            </CardGroup>
            <CardGroup title="Billing">
              <KeyValue
                layout="rows"
                items={[
                  { label: 'Total', value: amountText(visit.totalAmount) },
                  {
                    label: 'Diagnoses',
                    value:
                      visit.diagnosisCodes.map((code, index) => `${index + 1} · ${code}`).join(', ') ||
                      'None',
                  },
                  visit.authorization === null
                    ? {
                        label: 'Authorization',
                        value: refs.authorizationLabel(visit.authorizationId) || 'None',
                      }
                    : {
                        label: 'Authorization',
                        value: visit.authorization.number,
                        sub: `${formatIsoDate(visit.authorization.start_date)} – ${formatIsoDate(visit.authorization.end_date)}`,
                      },
                  {
                    label: 'Released',
                    value: visit.releasedAt === '' ? 'Not yet' : formatIsoDate(visit.releasedAt.slice(0, 10)),
                  },
                ]}
              />
            </CardGroup>
          </div>
        </div>
      </DetailCard>

      <DetailCard
        className="mt-4"
        title="Charge lines"
        meta={`${visit.chargeLines.length} ${visit.chargeLines.length === 1 ? 'line' : 'lines'}`}
        {...(released
          ? {}
          : {
              aside: (
                <Button
                  size="sm"
                  icon={<Plus size={14} aria-hidden="true" />}
                  onClick={() => setEditingLine(null)}
                >
                  Add charge line
                </Button>
              ),
            })}
      >
        <DataTable
          className="mt-2"
          caption={`Charge lines of the visit on ${formatIsoDate(visit.dateOfService)}`}
          columns={columns}
          rows={visit.chargeLines}
          getRowId={(line) => String(line.id)}
          empty={
            <CardEmpty title="No charge lines on this visit">
              A visit is released with at least one.
            </CardEmpty>
          }
        />
      </DetailCard>

      {claims?.(visit)}

      {editing && <EditVisitDialog visit={visit} onClose={() => setEditing(false)} />}

      {editingLine !== undefined && (
        <ChargeLineDialog
          key={editingLine?.id ?? 'new'}
          visit={visit}
          line={editingLine}
          onClose={() => setEditingLine(undefined)}
        />
      )}

      <ConfirmDialog
        open={deletingLine !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingLine(null)
        }}
        title="Delete this charge line?"
        description={
          deletingLine === null
            ? ''
            : `${procedureOf(deletingLine).code} × ${deletingLine.units} comes off the visit, and its total with it.`
        }
        confirmLabel="Delete charge line"
        tone="destructive"
        onConfirm={async () => {
          if (deletingLine === null) return
          try {
            const message = await removeLine.mutateAsync(deletingLine.id)
            toast.success(message ?? 'Charge line deleted')
          } catch (error) {
            toast.error(
              'The charge line was not deleted',
              isApiError(error) ? userMessage(error) : 'Something went wrong. Please try again.',
            )
          }
        }}
      />

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete this visit?"
        description={`The visit on ${formatIsoDate(visit.dateOfService)} and its charge lines are deleted. This cannot be undone.`}
        confirmLabel="Delete visit"
        tone="destructive"
        onConfirm={async () => {
          try {
            const message = await remove.mutateAsync(visit.id)
            toast.success(message ?? 'Visit deleted')
            void navigate({ to: '/visits' })
          } catch (error) {
            toast.error(
              'The visit was not deleted',
              isApiError(error) ? userMessage(error) : 'Something went wrong. Please try again.',
            )
          }
        }}
      />
    </PageContainer>
  )
}
