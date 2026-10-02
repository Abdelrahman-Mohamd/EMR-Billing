import { useState } from 'react'
import { Landmark, Pencil, Plus } from 'lucide-react'
import { toast } from '@/stores/toast-store'
import { Badge, Tag } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { KeyValue } from '@/components/ui/KeyValue'
import { RowActionButton } from '@/components/ui/RowActions'
import { EmptyState } from '@/components/ui/States'
import { insuranceLabel, useInsuranceClasses, useInsurances } from '@/features/admin-insurances'
import { formatIsoDate } from '@/lib/utils/dates'
import { usePatientRecords } from '../../data/patient-records-store'
import type { Coverage } from '../../model/coverage'
import { effectiveRule } from '../../model/insurance-rules'
import { toCoverageValues } from '../../schemas/coverage-form'
import { CoverageDialog } from './CoverageDialog'
import { NeedsDialog } from './NeedsDialog'
import { ChartCard } from './ChartCard'

/**
 * The chart's Insurance: the patient's coverage list, as the prototype has it.
 * Each case chooses its Primary and Secondary from this list. A coverage shows
 * its insurance, the cases using it, the insurance's class, type, payer ID and
 * what it requires, then the member ID, group number (marked when missing),
 * claim number, subscriber and employer — with Edit and Remove.
 *
 * Remove is refused while a case uses the coverage, as in the prototype. (Its
 * other refusal — a coverage that has been billed — needs claims, which do not
 * exist here yet.)
 */
export function InsuranceSection({ patientId }: { patientId: string }) {
  const records = usePatientRecords()
  const insurances = useInsurances()
  const classes = useInsuranceClasses()
  /** `undefined`: no dialog. `null`: adding. A coverage: editing it. */
  const [editing, setEditing] = useState<Coverage | null | undefined>(undefined)
  const [removing, setRemoving] = useState<Coverage | null>(null)
  const [needsInsurance, setNeedsInsurance] = useState(false)

  const patient = records.patients.find((item) => item.id === patientId)
  if (patient === undefined) return null

  const coverages = records.coverages.filter((coverage) => coverage.patientId === patient.id)
  const allInsurances = insurances.data ?? []
  const insuranceOf = (coverage: Coverage) => allInsurances.find((item) => item.id === coverage.insuranceId)
  const practiceClasses = (classes.data ?? []).filter((item) => item.practiceId === patient.practiceId)
  // The prototype offers the practice's active insurances.
  const offered = (current: Coverage | null) =>
    allInsurances.filter(
      (item) => item.practiceId === patient.practiceId && (item.isActive || item.id === current?.insuranceId),
    )
  const usingCases = (coverage: Coverage) =>
    records.cases.filter(
      (item) => item.primaryCoverageId === coverage.id || item.secondaryCoverageId === coverage.id,
    )

  const add = () => {
    if (offered(null).length === 0) setNeedsInsurance(true)
    else setEditing(null)
  }

  return (
    <>
      <ChartCard
        id="insurance"
        className="mt-4"
        title="Insurance coverage"
        description="The patient’s policies · each case chooses its primary and secondary from this list"
        aside={
          <Button size="sm" variant="primary" icon={<Plus size={14} aria-hidden="true" />} onClick={add}>
            Add coverage
          </Button>
        }
      >
        {coverages.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              icon={<Landmark size={20} />}
              title="No insurance for this patient"
              description="Add the patient’s coverage here, then choose it as a case’s primary insurance. Visits on a case without a primary insurance are pended."
            />
          </div>
        ) : (
          <ul className="mt-1" aria-label="Coverage">
            {coverages.map((coverage) => {
              const insurance = insuranceOf(coverage)
              const name = insurance === undefined ? 'Insurance' : insuranceLabel(insurance)
              const insuranceClass = practiceClasses.find((item) => item.id === insurance?.insuranceClassId)
              const used = usingCases(coverage)
              const subscriber = coverage.subscriber
              return (
                <li key={coverage.id} className="border-rule-row border-t py-4 first:border-t-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="text-row text-ink min-w-0 flex-1 basis-60 font-medium break-words">
                      {name}
                    </span>
                    <span className="flex flex-none items-center gap-1.5">
                      <Button
                        size="sm"
                        icon={<Pencil size={14} aria-hidden="true" />}
                        aria-label={`Edit coverage ${name}`}
                        onClick={() => setEditing(coverage)}
                      >
                        Edit
                      </Button>
                      <RowActionButton
                        action="delete"
                        label={`Remove coverage ${name}`}
                        title="Remove"
                        onClick={() => {
                          if (used.length > 0) {
                            toast.warning(
                              'This coverage is used on a case',
                              `Choose another insurance on ${used.map((item) => `“${item.name}”`).join(', ')} first.`,
                            )
                            return
                          }
                          setRemoving(coverage)
                        }}
                      />
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {used.length === 0 ? (
                      <span className="text-micro text-n500">Not used on a case yet</span>
                    ) : (
                      used.map((item) => (
                        <Tag key={item.id} tone="brand">
                          {item.primaryCoverageId === coverage.id ? 'Primary' : 'Secondary'} · {item.name}
                        </Tag>
                      ))
                    )}
                  </div>
                  {insurance !== undefined && (
                    <p className="text-micro text-n500 mt-1.5">
                      {[
                        insuranceClass?.name ?? '—',
                        insurance.insuranceType || '—',
                        `Payer ID ${insurance.payerId || '—'}`,
                        ...(effectiveRule(insurance, practiceClasses, 'authorizationRequired')
                          ? ['Authorization required']
                          : []),
                        ...(insurance.insuranceHold ? ['Insurance hold (manual release)'] : []),
                      ].join(' · ')}
                    </p>
                  )}
                  <KeyValue
                    className="max-sm:grid-cols-2"
                    items={[
                      { label: 'Member ID', value: coverage.memberId },
                      {
                        label: 'Group number',
                        value:
                          coverage.groupNumber === '' ? (
                            <Badge tone="critical" dot={false}>
                              Missing — required for billing
                            </Badge>
                          ) : (
                            coverage.groupNumber
                          ),
                      },
                      { label: 'Claim number', value: coverage.claimNumber },
                      {
                        label: 'Subscriber',
                        value:
                          subscriber === null
                            ? 'The patient (self)'
                            : [
                                subscriber.name || '(name missing)',
                                subscriber.relationship,
                                subscriber.dob === '' ? '' : formatIsoDate(subscriber.dob),
                              ]
                                .filter(Boolean)
                                .join(' · '),
                      },
                      ...(coverage.employer === null
                        ? []
                        : [
                            {
                              label: 'Employer (WC)',
                              value: [coverage.employer.name, coverage.employer.address]
                                .filter(Boolean)
                                .join(' — '),
                            },
                          ]),
                    ]}
                  />
                </li>
              )
            })}
          </ul>
        )}
      </ChartCard>

      {editing !== undefined && (
        <CoverageDialog
          key={editing?.id ?? 'new'}
          coverage={editing}
          insurances={offered(editing)}
          onSave={(values) => {
            if (editing === null) {
              records.addCoverage(patient.id, toCoverageValues(values))
              toast.success('Coverage saved', 'Choose it on a case as the primary or secondary insurance.')
            } else {
              records.updateCoverage(editing.id, toCoverageValues(values))
              toast.success('Coverage saved')
            }
          }}
          onClose={() => setEditing(undefined)}
        />
      )}

      {needsInsurance && (
        <NeedsDialog
          title="Cannot add coverage yet"
          description="Coverage links this patient to one of the practice’s insurances, with the member ID and group number for that policy. Claims are addressed to a coverage, never to an insurance directly. The practice has no insurances yet."
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
        title="Remove this coverage?"
        description={
          removing === null
            ? ''
            : `${insuranceOf(removing)?.name ?? 'The insurance'} is removed from the patient’s insurance list.`
        }
        confirmLabel="Remove coverage"
        tone="destructive"
        onConfirm={() => {
          if (removing !== null) records.removeCoverage(removing.id)
          setRemoving(null)
        }}
      />
    </>
  )
}
