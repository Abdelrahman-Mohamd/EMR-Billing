import { useState } from 'react'
import { Plus, Send } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Section } from '@/components/ui/Card'
import { CellSub, DataTable, type Column } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/States'
import { modifiersText, pointersText, useVisitReferences, type Visit } from '@/features/visits'
import { formatIsoDate } from '@/lib/utils/dates'
import { useClaims } from '../queries/use-claims'
import type { Claim } from '../schemas/claim'
import { CreateClaimDialog } from './CreateClaimDialog'

/**
 * A visit's claims, on the visit (Visit → Charge line → Claim): each with the
 * procedure line it carries, and "Create claim" from one of the visit's lines.
 */
export function VisitClaims({ visit }: { visit: Visit }) {
  const claims = useClaims()
  const refs = useVisitReferences()
  const [creating, setCreating] = useState(false)
  const mine = (claims.data ?? []).filter((claim) => claim.visitId === visit.id)
  const noLines = visit.chargeLines.length === 0

  const columns: ReadonlyArray<Column<Claim>> = [
    {
      key: 'procedure',
      header: 'Procedure',
      primary: true,
      cell: (claim) => {
        const procedure = refs.procedure(claim.procedureCode)
        return (
          <span className="block min-w-0">
            <span className="tabular-nums">{procedure.code}</span>
            {procedure.description !== '' && <CellSub>{procedure.description}</CellSub>}
          </span>
        )
      },
    },
    { key: 'units', header: 'Units', cell: (claim) => <span className="tabular-nums">{claim.units}</span> },
    {
      key: 'modifiers',
      header: 'Modifiers',
      cell: (claim) => modifiersText(claim) || <span className="text-n400">—</span>,
    },
    {
      key: 'pointers',
      header: 'Diagnosis pointers',
      cell: (claim) => pointersText(claim, visit.caseId, refs) || <span className="text-n400">—</span>,
    },
  ]

  return (
    <Section
      title="Claims"
      aside={
        noLines ? undefined : (
          <Button size="sm" icon={<Plus size={14} aria-hidden="true" />} onClick={() => setCreating(true)}>
            Create claim
          </Button>
        )
      }
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
          <div className="pt-4">
            <EmptyState
              icon={<Send size={20} />}
              title="No claims for this visit yet"
              description={noLines ? 'Add a charge line first.' : 'Create one from a charge line.'}
            />
          </div>
        }
      />
      {creating && <CreateClaimDialog visit={visit} onClose={() => setCreating(false)} />}
    </Section>
  )
}
