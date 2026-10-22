import { useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from '@/stores/toast-store'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { CellSub, DataTable, type Column } from '@/components/ui/DataTable'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { RowActionButton, RowActions, actionsColumn } from '@/components/ui/RowActions'
import { CardEmpty, DetailCard } from '@/components/ui/DetailCard'
import { isReleased, useVisitReferences, type Visit } from '@/features/visits'
import { isApiError, userMessage } from '@/lib/api/api-error'
import { formatIsoDate } from '@/lib/utils/dates'
import { formatMoney } from '@/lib/utils/money'
import { useClaims, useDeleteClaim, useScrubClaim } from '../queries/use-claims'
import { canDelete, canScrub, claimStatus, formatName, type Claim } from '../schemas/claim'
import { CreateClaimDialog } from './CreateClaimDialog'
import { EditClaimDialog } from './EditClaimDialog'

const money = (amount: string) => {
  const value = Number(amount)
  return amount === '' || Number.isNaN(value) ? '—' : formatMoney(value)
}

/**
 * A visit's claims, on the visit: one per insurance billed, each for the whole
 * visit — the insurance, format, total, status (with what the scrub found) and
 * when it was sent. A released visit can be billed: "Create claim" to one of
 * the case's insurances not billed yet. Each claim shows the server's
 * references (its claim number, the payer's, the clearinghouse's) and can be
 * edited (its status moved on, its format, the clearinghouse's reference) and,
 * until sent, scrubbed again — after the data it flagged is fixed — or
 * deleted.
 */
export function VisitClaims({ visit }: { visit: Visit }) {
  // Only this visit's, asked of the server (`visit_id`).
  const claims = useClaims({ visitId: visit.id })
  const refs = useVisitReferences()
  const remove = useDeleteClaim()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Claim | null>(null)
  const [deleting, setDeleting] = useState<Claim | null>(null)
  const mine = claims.data ?? []
  const released = isReleased(visit)
  // The case's insurances not billed for this visit yet, in the server's order.
  const billable = refs.records.coverages
    .filter((coverage) => coverage.caseId === visit.caseId)
    .filter((coverage) => !mine.some((claim) => claim.coverageId === coverage.id))

  const scrub = useScrubClaim()
  const scrubAgain = async (claim: Claim) => {
    try {
      const result = await scrub.mutateAsync(claim.id)
      const errors = result.claim.scrubErrors
      if (errors.length > 0) toast.warning(result.message ?? 'Claim scrubbed', errors.join(' '))
      else toast.success(result.message ?? 'Claim scrubbed')
    } catch (error) {
      toast.error(
        `The claim to ${claim.insuranceName} was not scrubbed`,
        isApiError(error) ? userMessage(error) : 'Something went wrong. Please try again.',
      )
    }
  }

  const columns: ReadonlyArray<Column<Claim>> = [
    {
      key: 'insurance',
      header: 'Insurance',
      primary: true,
      cell: (claim) => (
        <span className="block min-w-0">
          <span className="break-words">{claim.insuranceName || '—'}</span>
          {claim.rankLabel !== '' && <CellSub>{claim.rankLabel}</CellSub>}
        </span>
      ),
    },
    {
      key: 'number',
      header: 'Claim #',
      cell: (claim) => (
        <span className="block min-w-0">
          <span className="tabular-nums">{claim.controlNumber || '—'}</span>
          {claim.payerClaimNumber !== '' && <CellSub>Payer # {claim.payerClaimNumber}</CellSub>}
        </span>
      ),
    },
    { key: 'format', header: 'Format', cell: (claim) => formatName(claim.format) },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      cell: (claim) => <span className="tabular-nums">{money(claim.totalAmount)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (claim) => {
        const status = claimStatus(claim.status)
        return (
          <span className="block min-w-0">
            <Badge tone={status.tone}>{status.label}</Badge>
            {claim.scrubErrors.map((error) => (
              <CellSub key={error}>
                <span className="text-critical">{error}</span>
              </CellSub>
            ))}
          </span>
        )
      },
    },
    {
      key: 'sent',
      header: 'Sent',
      cell: (claim) => (
        <span className="block min-w-0">
          <span className="whitespace-nowrap tabular-nums">
            {claim.sentDate === '' ? '—' : formatIsoDate(claim.sentDate)}
          </span>
          {claim.clearinghouseRef !== '' && <CellSub>Ref. {claim.clearinghouseRef}</CellSub>}
          {(claim.clearinghouseStatus !== '' || claim.clearinghouseBatchId !== '') && (
            <CellSub>
              {[
                claim.clearinghouseStatus,
                claim.clearinghouseBatchId === '' ? '' : `batch ${claim.clearinghouseBatchId}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </CellSub>
          )}
        </span>
      ),
    },
    actionsColumn<Claim>((claim) => (
      <RowActions>
        <RowActionButton
          action="edit"
          label={`Edit the claim to ${claim.insuranceName}`}
          onClick={() => setEditing(claim)}
        />
        {canScrub(claim) && (
          <RowActionButton
            action="recheck"
            title="Scrub again"
            label={`Scrub the claim to ${claim.insuranceName} again`}
            onClick={() => void scrubAgain(claim)}
          />
        )}
        {canDelete(claim) && (
          <RowActionButton
            action="delete"
            label={`Delete the claim to ${claim.insuranceName}`}
            onClick={() => setDeleting(claim)}
          />
        )}
      </RowActions>
    )),
  ]

  return (
    <DetailCard
      className="mt-4"
      title="Claims"
      info="One claim per insurance billed, each for the whole visit — every charge line on it."
      {...(released && billable.length > 0
        ? {
            aside: (
              <Button
                size="sm"
                icon={<Plus size={14} aria-hidden="true" />}
                onClick={() => setCreating(true)}
              >
                Create claim
              </Button>
            ),
          }
        : {})}
    >
      <DataTable
        className="mt-2"
        caption={`Claims of the visit on ${formatIsoDate(visit.dateOfService)}`}
        columns={columns}
        rows={mine}
        getRowId={(claim) => String(claim.id)}
        loading={claims.isPending}
        error={claims.isError}
        onRetry={() => void claims.refetch()}
        empty={
          <CardEmpty title="No claims for this visit yet">
            {released
              ? 'Create one to bill the visit to an insurance.'
              : 'Release the visit first: only a released visit can be billed.'}
          </CardEmpty>
        }
      />

      {creating && (
        <CreateClaimDialog visit={visit} coverages={billable} onClose={() => setCreating(false)} />
      )}
      {editing !== null && (
        <EditClaimDialog key={editing.id} claim={editing} onClose={() => setEditing(null)} />
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title="Delete this claim?"
        description={
          deleting === null
            ? ''
            : `The claim to ${deleting.insuranceName} is deleted. The visit can be billed again.`
        }
        confirmLabel="Delete claim"
        tone="destructive"
        onConfirm={async () => {
          if (deleting === null) return
          try {
            const message = await remove.mutateAsync(deleting.id)
            toast.success(message ?? 'Claim deleted')
          } catch (error) {
            toast.error(
              'The claim was not deleted',
              isApiError(error) ? userMessage(error) : 'Something went wrong. Please try again.',
            )
          }
        }}
      />
    </DetailCard>
  )
}
