import { useState } from 'react'
import { Plus } from 'lucide-react'
import { isApiError, userMessage } from '@/lib/api/api-error'
import { toast } from '@/stores/toast-store'
import { Tag } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { CellSub, DataTable, type Column } from '@/components/ui/DataTable'
import { RowActionButton, RowActions, actionsColumn } from '@/components/ui/RowActions'
import { useInsuranceClasses, useInsurances } from '@/features/admin-insurances'
import { formatIsoDate } from '@/lib/utils/dates'
import { usePatientRecords } from '../../data/patient-records-store'
import type { PatientCase } from '../../model/case'
import { RANKS, coveragesOf, rankName, subscriberName, type Coverage } from '../../model/coverage'
import { effectiveRule } from '../../model/insurance-rules'
import { genderName, type PatientSummary } from '../../model/patient'
import {
  useCreateCaseInsurance,
  useDeleteCaseInsurance,
  useUpdateCaseInsurance,
} from '../../queries/use-case-insurances'
import { toCoveragePayload, toCoverageUpdatePayload } from '../../schemas/coverage-form'
import { CardEmpty, ChartCard } from './ChartCard'
import { CoverageDialog } from './CoverageDialog'
import { NeedsDialog } from './NeedsDialog'

/**
 * The case's Insurance: its insurances, in rank order — Primary, Secondary,
 * Tertiary — as the server keeps them (user 2026-10-08: a coverage belongs to
 * a case). A table, a row each (user, 2026-10-08: the chart reads clearer in
 * tables): the insurance with its class, type, payer ID and what it requires,
 * the member and group numbers, the claim number, the dates it is in effect,
 * the subscriber and — when one has — the employer, then Edit and Delete as
 * the tables' icon buttons. "Add insurance" offers the practice's active
 * insurances not on the case yet.
 */
export function InsuranceSection({ patient, caseItem }: { patient: PatientSummary; caseItem: PatientCase }) {
  const records = usePatientRecords()
  const insurances = useInsurances()
  const classes = useInsuranceClasses()
  const create = useCreateCaseInsurance()
  const update = useUpdateCaseInsurance()
  const remove = useDeleteCaseInsurance()
  /** `undefined`: no dialog. `null`: adding. A coverage: editing it. */
  const [editing, setEditing] = useState<Coverage | null | undefined>(undefined)
  const [removing, setRemoving] = useState<Coverage | null>(null)
  const [needsInsurance, setNeedsInsurance] = useState(false)

  const coverages = coveragesOf(records.coverages, caseItem.id)
  const allInsurances = insurances.data ?? []
  const insuranceOf = (coverage: Coverage) => allInsurances.find((item) => item.id === coverage.insuranceId)
  const nameOf = (coverage: Coverage) => coverage.insuranceLabel || coverage.insuranceName || 'Insurance'
  const practiceClasses = (classes.data ?? []).filter((item) => item.practiceId === patient.practiceId)
  const onCase = new Set(coverages.map((coverage) => coverage.insuranceId))
  // The practice's active insurances, those not on the case yet.
  const offered = allInsurances.filter(
    (item) => item.practiceId === patient.practiceId && item.isActive && !onCase.has(item.id),
  )
  const nextRank = RANKS.find((rank) => !coverages.some((coverage) => String(coverage.rank) === rank.value))
  const add = () => {
    if (allInsurances.every((item) => item.practiceId !== patient.practiceId || !item.isActive))
      setNeedsInsurance(true)
    else setEditing(null)
  }

  const columns: Column<Coverage>[] = [
    {
      key: 'priority',
      header: 'Priority',
      cell: (coverage) => <Tag tone={coverage.rank === 1 ? 'brand' : 'inert'}>{rankName(coverage)}</Tag>,
    },
    {
      key: 'insurance',
      header: 'Insurance',
      primary: true,
      cell: (coverage) => {
        const insurance = insuranceOf(coverage)
        const insuranceClass = practiceClasses.find((item) => item.id === insurance?.insuranceClassId)
        // The class and the type often say the same thing ("Workers' Comp"): once.
        const kind = [insuranceClass?.name, insurance?.insuranceTypeLabel]
          .filter((part): part is string => part !== undefined && part !== '')
          .filter((part, index, parts) => parts.findIndex((other) => sameWords(other, part)) === index)
        const flags = [
          ...(effectiveRule(insurance, practiceClasses, 'authorizationRequired')
            ? ['Authorization required']
            : []),
          ...(insurance?.insuranceHold === true ? ['Insurance hold'] : []),
        ]
        return (
          <>
            <span className="text-ink font-medium break-words">{nameOf(coverage)}</span>
            {insurance !== undefined && (
              <CellSub>{[...kind, `Payer ID ${insurance.payerId || '—'}`].join(' · ')}</CellSub>
            )}
            {flags.length > 0 && (
              <span className="mt-1.5 flex flex-wrap gap-1.5">
                {flags.map((flag) => (
                  <Tag key={flag} tone="attention">
                    {flag}
                  </Tag>
                ))}
              </span>
            )}
          </>
        )
      },
    },
    {
      key: 'member',
      header: 'Member ID',
      cell: (coverage) => (
        <>
          <span className="whitespace-nowrap">
            <Plain value={coverage.memberId} />
          </span>
          {/* Optional on the server: many plans have none (Box 11 stays blank). */}
          {coverage.groupNumber !== '' && (
            <CellSub>
              <span className="whitespace-nowrap">Group {coverage.groupNumber}</span>
            </CellSub>
          )}
        </>
      ),
    },
    {
      key: 'claim',
      header: 'Claim number',
      cell: (coverage) => <Plain value={coverage.claimNumber} />,
    },
    {
      key: 'dates',
      header: 'In effect',
      cell: (coverage) => {
        const from = coverage.effectiveDate === '' ? '' : formatIsoDate(coverage.effectiveDate)
        const to = coverage.terminationDate === '' ? '' : formatIsoDate(coverage.terminationDate)
        if (from === '' && to === '') return <Plain value="" />
        // Wraps between the two dates, never inside one.
        return (
          <span className="tabular-nums">
            <span className="whitespace-nowrap">{from === '' ? 'Until' : `${from} –`}</span>{' '}
            <span className="whitespace-nowrap">{to === '' ? 'no end date' : to}</span>
          </span>
        )
      },
    },
    {
      key: 'subscriber',
      header: 'Subscriber',
      cell: ({ subscriber }) =>
        subscriber === null ? (
          'The patient (self)'
        ) : (
          <>
            <span className="break-words">{subscriberName(subscriber) || '(name missing)'}</span>
            <CellSub>
              {[
                subscriber.relationship,
                subscriber.dob === '' ? '' : `born ${formatIsoDate(subscriber.dob)}`,
                genderName({ gender: subscriber.gender, genderLabel: '' }),
              ]
                .filter(Boolean)
                .join(' · ')}
            </CellSub>
          </>
        ),
    },
    // Only Workers' Comp names an employer: the column shows when one does.
    ...(coverages.some((coverage) => coverage.employer !== null)
      ? [
          {
            key: 'employer',
            header: 'Employer',
            cell: ({ employer }: Coverage) =>
              employer === null ? (
                <Plain value="" />
              ) : (
                <>
                  <span className="break-words">{employer.name}</span>
                  {employer.address !== null && (
                    <CellSub>
                      {`${employer.address.line1}, ${employer.address.city}, ${employer.address.state} ${employer.address.zip}`}
                    </CellSub>
                  )}
                </>
              ),
          },
        ]
      : []),
    actionsColumn<Coverage>((coverage) => (
      <RowActions>
        <RowActionButton
          action="edit"
          label={`Edit ${nameOf(coverage)}`}
          onClick={() => setEditing(coverage)}
        />
        <RowActionButton
          action="delete"
          label={`Delete ${nameOf(coverage)}`}
          onClick={() => setRemoving(coverage)}
        />
      </RowActions>
    )),
  ]

  return (
    <>
      <ChartCard
        id="insurance"
        className="mt-4"
        headingLevel={3}
        title="Insurance"
        info="The insurances this case is billed to. Claims go to the primary first, then the secondary and the tertiary."
        aside={
          <Button size="sm" icon={<Plus size={14} aria-hidden="true" />} onClick={add}>
            Add insurance
          </Button>
        }
      >
        <DataTable
          className="mt-2"
          caption={`Insurances of ${caseItem.name}`}
          columns={columns}
          rows={coverages}
          getRowId={(coverage) => coverage.id}
          empty={
            <CardEmpty title="No insurance on this case">
              Add the insurance it is billed to — visits on a case without a primary insurance are pended.
            </CardEmpty>
          }
        />
      </ChartCard>

      {editing !== undefined && (
        <CoverageDialog
          key={editing?.id ?? 'new'}
          coverage={editing}
          insurances={offered}
          nextRank={nextRank?.value ?? null}
          onSave={async (values) => {
            const message =
              editing === null
                ? await create.mutateAsync(toCoveragePayload(caseItem.id, values))
                : await update.mutateAsync({ id: editing.id, payload: toCoverageUpdatePayload(values) })
            toast.success(message ?? 'Insurance saved')
          }}
          onClose={() => setEditing(undefined)}
        />
      )}

      {needsInsurance && (
        <NeedsDialog
          title="Cannot add insurance yet"
          description="A case is billed to one of the practice’s insurances, with the member ID and group number of the patient’s policy. The practice has no active insurances yet."
          needs={[
            {
              ok: practiceClasses.some((item) => item.isActive),
              label: 'An insurance class',
              why: 'Every insurance belongs to exactly one class.',
              action: { label: 'Create an insurance class', link: { to: '/setup/insurance-classes' } },
            },
            {
              ok: false,
              label: 'An insurance',
              why: 'The payer as the practice bills it.',
              action: { label: 'Add an insurance', link: { to: '/setup/insurances' } },
            },
          ]}
          onClose={() => setNeedsInsurance(false)}
        />
      )}

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null)
        }}
        title="Delete this insurance?"
        description={
          removing === null
            ? ''
            : `${removing.insuranceName || 'The insurance'} is taken off ${caseItem.name}, with the authorizations it issued.`
        }
        confirmLabel="Delete insurance"
        tone="destructive"
        onConfirm={async () => {
          if (removing === null) return
          try {
            const message = await remove.mutateAsync(removing.id)
            toast.success(message ?? 'Insurance deleted')
          } catch (error) {
            toast.error(
              'The insurance was not deleted',
              isApiError(error) ? userMessage(error) : 'Something went wrong. Please try again.',
            )
          }
        }}
      />
    </>
  )
}

/**
 * The same words, whatever their case, punctuation or where the plural "s"
 * falls: "Worker's Comp" and "Workers' Comp".
 */
const sameWords = (a: string, b: string) => {
  const plain = (text: string) => text.toLowerCase().replace(/[^a-z0-9]|s/g, '')
  return plain(a) === plain(b)
}

/** A value, or a dash said as "None" when there is none. */
function Plain({ value }: { value: string }) {
  if (value !== '') return <span className="break-words">{value}</span>
  return (
    <span className="text-n400">
      <span aria-hidden="true">—</span>
      <span className="sr-only">None</span>
    </span>
  )
}
