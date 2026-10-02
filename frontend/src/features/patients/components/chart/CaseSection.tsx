import { useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, FileCheck, Hash, Pencil, Plus } from 'lucide-react'
import { toast } from '@/stores/toast-store'
import { Badge, Tag } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { KeyValue } from '@/components/ui/KeyValue'
import { RowActionButton, actionsColumn } from '@/components/ui/RowActions'
import { Notice } from '@/components/ui/Notice'
import { EmptyState } from '@/components/ui/States'
import {
  insuranceLabel,
  useInsuranceClasses,
  useInsurances,
  type Insurance,
} from '@/features/admin-insurances'
import { useReferringPhysicians } from '@/features/admin-referring-physicians'
import { cn } from '@/lib/utils/cn'
import { formatIsoDate, todayIso } from '@/lib/utils/dates'
import { usePatientRecords } from '../../data/patient-records-store'
import { authRemaining, authStatus, type Authorization } from '../../model/authorization'
import { MAX_DIAGNOSES, type PatientCase } from '../../model/case'
import type { Coverage } from '../../model/coverage'
import { effectiveRule } from '../../model/insurance-rules'
import { casesOf, leadCase } from '../../model/roster'
import { toAuthorizationValues } from '../../schemas/authorization-form'
import { AuthorizationDialog } from './AuthorizationDialog'
import { CaseEditor } from './CaseEditor'
import { DiagnosisDialog } from './DiagnosisDialog'
import { ChartCard } from './ChartCard'
import { SCROLL_MARGIN, scrollToSection } from './chart-scroll'

const required = (
  <Badge tone="critical" dot={false}>
    Required for billing
  </Badge>
)

/**
 * The chart's Case part. It opens on a header naming the case shown — its
 * status, start of care, primary insurance and which of the patient's cases it
 * is — chosen, or started, on the chart's case card. Then the case, a section
 * per topic as in the prototype (client 2026-09-30): Case details, the case's Insurance (primary
 * and secondary, chosen from the patient's list), Diagnoses (ICD-10, in pointer
 * order) and Authorizations. The case chosen is in the URL (`?case=<id>`);
 * with none, the first open case.
 *
 * Not built, because they need visits: the case's visit locations, the Visits &
 * claims list, and authorizations' use (an authorization is never used here, so
 * every one can be deleted).
 */
export function CaseSection({ patientId, caseId }: { patientId: string; caseId: string | undefined }) {
  const records = usePatientRecords()
  const insurances = useInsurances()
  const classes = useInsuranceClasses()
  const referrers = useReferringPhysicians()
  const [editing, setEditing] = useState<PatientCase | null | undefined>(undefined)
  const [addingDiagnosis, setAddingDiagnosis] = useState(false)
  const [removingDiagnosis, setRemovingDiagnosis] = useState<number | null>(null)
  const [addingAuth, setAddingAuth] = useState(false)
  const [deletingAuth, setDeletingAuth] = useState<Authorization | null>(null)

  const patient = records.patients.find((item) => item.id === patientId)
  if (patient === undefined) return null

  const cases = casesOf(records.cases, patient.id)
  const current = cases.find((item) => item.id === caseId) ?? leadCase(cases)
  const coverages = records.coverages.filter((coverage) => coverage.patientId === patient.id)
  const allInsurances = insurances.data ?? []
  const practiceClasses = (classes.data ?? []).filter((item) => item.practiceId === patient.practiceId)
  const practiceReferrers = (referrers.data ?? []).filter((item) => item.practiceId === patient.practiceId)
  const insuranceOf = (coverage: Coverage | undefined): Insurance | undefined =>
    coverage === undefined ? undefined : allInsurances.find((item) => item.id === coverage.insuranceId)
  const coverageById = (id: string | null) => coverages.find((coverage) => coverage.id === id)
  const caseDialog =
    editing === undefined ? null : (
      <CaseEditor patientId={patient.id} item={editing} onClose={() => setEditing(undefined)} />
    )

  // The case part opens on the case it shows, so what follows is plainly its.
  // Switching and starting a case are on the chart's case card.
  const header = (
    <div id="case" className={cn('mt-12', SCROLL_MARGIN)}>
      <p aria-hidden="true" className="text-eyebrow text-n500 font-medium uppercase">
        Case
      </p>
      {current === undefined ? (
        <>
          <h2 className="text-ink mt-1 text-[20px] leading-tight font-medium">
            <span className="sr-only">Case:</span> No case yet
          </h2>
          <div className="mt-4">
            <Button
              variant="primary"
              icon={<Plus size={16} aria-hidden="true" />}
              onClick={() => setEditing(null)}
            >
              New case
            </Button>
          </div>
        </>
      ) : (
        <>
          <h2 className="text-ink mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[20px] leading-tight font-medium">
            <span className="min-w-0 break-words">
              <span className="sr-only">Case:</span> {current.name}
            </span>
            <Badge tone={current.isActive ? 'success' : 'inert'}>
              {current.isActive ? 'Open' : 'Closed'}
            </Badge>
          </h2>
          <p className="text-meta text-n500 mt-1.5">
            {[
              current.startOfCare === '' ? 'No start of care' : `Since ${formatIsoDate(current.startOfCare)}`,
              insuranceOf(coverageById(current.primaryCoverageId))?.name ?? 'No insurance',
              cases.length > 1
                ? `${cases.findIndex((item) => item.id === current.id) + 1} of ${cases.length} cases`
                : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </>
      )}
    </div>
  )

  if (current === undefined)
    return (
      <>
        {header}
        {caseDialog}
      </>
    )

  const primaryCoverage = coverageById(current.primaryCoverageId)
  const primaryInsurance = insuranceOf(primaryCoverage)
  const caseCoverages = [primaryCoverage, coverageById(current.secondaryCoverageId)].filter(
    (coverage): coverage is Coverage => coverage !== undefined,
  )
  const referrer = practiceReferrers.find((item) => item.id === current.referrerId)
  const injuryDateNeeded =
    current.injuryType !== '' || effectiveRule(primaryInsurance, practiceClasses, 'injuryDateRequired')
  const authNeeded = caseCoverages.some((coverage) =>
    effectiveRule(insuranceOf(coverage), practiceClasses, 'authorizationRequired'),
  )
  const auths = records.authorizations.filter((auth) => auth.caseId === current.id)
  const today = todayIso()

  const coverageCard = (rank: 'Primary' | 'Secondary', coverage: Coverage | undefined) => {
    const insurance = insuranceOf(coverage)
    return (
      <div
        className={cn(
          'min-w-0',
          // Primary then Secondary: side by side from 640px, a hairline between.
          rank === 'Secondary' && 'border-rule-row border-t pt-4 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-6',
        )}
      >
        <p
          className={cn(
            'text-eyebrow font-medium uppercase',
            coverage === undefined ? 'text-n500' : 'text-brand-deep',
          )}
        >
          {rank} insurance
        </p>
        {coverage === undefined ? (
          <p className="text-meta text-n500 mt-1">
            {rank === 'Primary'
              ? 'Not chosen — visits on this case are pended until it is.'
              : 'None. Optional.'}
          </p>
        ) : (
          <>
            <p className="text-row text-ink mt-1 font-medium break-words">
              {insurance === undefined ? 'Insurance' : insuranceLabel(insurance)}
            </p>
            <p className="text-micro text-n500">
              Member {coverage.memberId || '—'} · Group {coverage.groupNumber || '—'}
              {effectiveRule(insurance, practiceClasses, 'authorizationRequired') &&
                ' · Authorization required'}
            </p>
          </>
        )}
      </div>
    )
  }

  const authColumns: ReadonlyArray<Column<Authorization>> = [
    {
      key: 'number',
      header: 'Authorization #',
      primary: true,
      cell: (auth) => (
        <span className="block">
          <span className="[overflow-wrap:anywhere] tabular-nums">{auth.number}</span>
          {/* Until their columns appear, the issuer and dates ride under the number.
              (From 1280px: below that the chart's menu takes the room.) */}
          <span className="text-eyebrow text-n500 mt-px block font-normal xl:hidden">
            {insuranceOf(coverageById(auth.coverageId))?.name ?? '—'} · {formatIsoDate(auth.start)} –{' '}
            {formatIsoDate(auth.end)}
          </span>
        </span>
      ),
    },
    {
      key: 'issuer',
      header: 'Issued by',
      hideBelow: 'xl',
      cell: (auth) => (
        <span className="break-words">{insuranceOf(coverageById(auth.coverageId))?.name ?? '—'}</span>
      ),
    },
    {
      key: 'dates',
      header: 'Active dates',
      hideBelow: 'xl',
      cell: (auth) => (
        // Wraps between the two dates, never inside one, when the card is narrow.
        <span className="tabular-nums">
          <span className="whitespace-nowrap">{formatIsoDate(auth.start)} –</span>{' '}
          <span className="whitespace-nowrap">{formatIsoDate(auth.end)}</span>
        </span>
      ),
    },
    {
      key: 'approved',
      header: 'Approved',
      hideBelow: 'md',
      cell: (auth) => (
        <span className="whitespace-nowrap tabular-nums">
          {auth.qty} {auth.unit.toLowerCase()}
        </span>
      ),
    },
    {
      key: 'used',
      header: 'Used',
      hideBelow: 'md',
      cell: (auth) => <span className="tabular-nums">{auth.used}</span>,
    },
    {
      key: 'remaining',
      header: 'Remaining',
      cell: (auth) => (
        <span
          className={cn('tabular-nums', authRemaining(auth) > 0 ? 'text-ink font-medium' : 'text-critical')}
        >
          {authRemaining(auth)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      hideOnMobile: true,
      cell: (auth) => {
        const status = authStatus(auth, today)
        return <Badge tone={status.tone}>{status.label}</Badge>
      },
    },
    actionsColumn<Authorization>((auth) => (
      <RowActionButton
        action="delete"
        label={`Delete authorization ${auth.number}`}
        onClick={() => {
          if (auth.used > 0) {
            toast.warning(
              'This authorization has been used',
              'Visits already consumed it, so it cannot be deleted.',
            )
            return
          }
          setDeletingAuth(auth)
        }}
      />
    )),
  ]

  const takenCodes = new Set(current.diagnoses.map((diagnosis) => diagnosis.code))

  return (
    <>
      {header}

      <ChartCard
        className="mt-4"
        headingLevel={3}
        title="Case details"
        description="Every visit inherits the referring physician, diagnoses, injury type and onset date"
        aside={
          <Button
            size="sm"
            icon={<Pencil size={14} aria-hidden="true" />}
            onClick={() => setEditing(current)}
          >
            Edit case
          </Button>
        }
      >
        <KeyValue
          className="max-sm:grid-cols-2"
          items={[
            {
              label: 'Referring physician',
              wide: true,
              value:
                referrer === undefined
                  ? required
                  : `${referrer.name} · ${referrer.type === 'DQ' ? 'Supervising (DQ)' : 'Referring (DN)'} · NPI ${referrer.npi}`,
            },
            { label: 'Injury type (related cause)', value: current.injuryType || 'Not related to an injury' },
            {
              label: 'Injury / onset date',
              value:
                current.injuryDate !== ''
                  ? formatIsoDate(current.injuryDate)
                  : injuryDateNeeded
                    ? required
                    : '',
            },
            { label: 'Accident state', value: current.accidentState },
            { label: 'Employment status', value: current.employmentStatus },
            {
              label: 'Start of care',
              value: current.startOfCare === '' ? '' : formatIsoDate(current.startOfCare),
            },
            {
              label: 'Discharge date',
              value: current.dischargeDate === '' ? '' : formatIsoDate(current.dischargeDate),
            },
          ]}
        />
      </ChartCard>

      <ChartCard
        className="mt-4"
        headingLevel={3}
        title="Insurance"
        description="Chosen from the patient’s insurance list · claims go to the primary first"
        aside={
          coverages.length > 0 ? (
            <Button
              size="sm"
              icon={<Pencil size={14} aria-hidden="true" />}
              onClick={() => setEditing(current)}
            >
              {caseCoverages.length > 0 ? 'Change' : 'Choose insurance'}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="primary"
              icon={<Plus size={14} aria-hidden="true" />}
              onClick={() => scrollToSection('insurance')}
            >
              Add the patient’s insurance
            </Button>
          )
        }
      >
        <div className="mt-4 grid gap-4 sm:grid-cols-2 sm:gap-6">
          {coverageCard('Primary', primaryCoverage)}
          {coverageCard('Secondary', coverageById(current.secondaryCoverageId))}
        </div>
      </ChartCard>

      <ChartCard
        className="mt-4"
        id="diagnoses"
        headingLevel={3}
        title="Diagnoses (ICD-10)"
        description={`${current.diagnoses.length} of ${MAX_DIAGNOSES} · the position is the diagnosis pointer on the claim (Box 21 / 24E)`}
        aside={
          <Button
            size="sm"
            variant="primary"
            icon={<Plus size={14} aria-hidden="true" />}
            onClick={() => {
              if (current.diagnoses.length >= MAX_DIAGNOSES) {
                toast.warning('A case holds up to 12 diagnoses', 'Remove one before adding another.')
                return
              }
              setAddingDiagnosis(true)
            }}
          >
            Add diagnosis
          </Button>
        }
      >
        {current.diagnoses.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon={<Hash size={20} />}
              title="No diagnoses on this case"
              description="At least one ICD-10 code is needed before a claim can point to it."
            />
          </div>
        ) : (
          <ol aria-label="Diagnoses" className="mt-3">
            {current.diagnoses.map((diagnosis, index) => (
              <li
                key={diagnosis.code}
                className="border-rule-row flex items-center gap-3 border-b py-2.5 last:border-b-0"
              >
                <span
                  aria-hidden="true"
                  className="bg-brand-wash text-brand-deep text-micro grid size-7 flex-none place-items-center rounded-full font-semibold tabular-nums"
                >
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="sr-only">Pointer {index + 1}: </span>
                  <span className="text-meta text-ink font-medium tabular-nums">{diagnosis.code}</span>{' '}
                  <span className="text-meta text-n600 break-words">{diagnosis.description}</span>
                  {index === 0 && (
                    <>
                      {' '}
                      <Tag tone="brand">Primary</Tag>
                    </>
                  )}
                </span>
                <span className="inline-flex flex-none gap-1.5">
                  <IconAction
                    label={`Move ${diagnosis.code} up`}
                    disabled={index === 0}
                    onClick={() => records.moveDiagnosis(current.id, index, -1)}
                  >
                    <ArrowUp size={14} aria-hidden="true" />
                  </IconAction>
                  <IconAction
                    label={`Move ${diagnosis.code} down`}
                    disabled={index === current.diagnoses.length - 1}
                    onClick={() => records.moveDiagnosis(current.id, index, 1)}
                  >
                    <ArrowDown size={14} aria-hidden="true" />
                  </IconAction>
                  <RowActionButton
                    action="delete"
                    label={`Remove ${diagnosis.code}`}
                    title="Remove"
                    onClick={() => setRemovingDiagnosis(index)}
                  />
                </span>
              </li>
            ))}
          </ol>
        )}
        <Notice tone="info" title="Visits keep a snapshot." className="mt-4">
          Each visit copies these codes when it arrives, so later edits here never change a claim that was
          already billed.
        </Notice>
      </ChartCard>

      <ChartCard
        className="mt-4"
        id="authorizations"
        headingLevel={3}
        title="Authorizations"
        description={
          authNeeded
            ? 'The primary insurance requires authorization — visits without one are pended'
            : 'Not required by the primary insurance'
        }
        aside={
          caseCoverages.length > 0 ? (
            <Button
              size="sm"
              variant="primary"
              icon={<Plus size={14} aria-hidden="true" />}
              onClick={() => setAddingAuth(true)}
            >
              Add authorization
            </Button>
          ) : undefined
        }
      >
        <DataTable
          className="mt-2"
          caption={`Authorizations of ${current.name}`}
          columns={authColumns}
          rows={[...auths].sort((a, b) => b.start.localeCompare(a.start))}
          getRowId={(auth) => auth.id}
          empty={
            <div className="mt-3">
              <EmptyState
                icon={<FileCheck size={20} />}
                title="No authorizations recorded"
                description={
                  authNeeded
                    ? 'Add the payer’s approval to release pended visits and held claims.'
                    : 'This payer does not require one.'
                }
              />
            </div>
          }
        />
      </ChartCard>

      {caseDialog}

      {addingDiagnosis && (
        <DiagnosisDialog
          pointer={current.diagnoses.length + 1}
          codes={records.icd10.filter((code) => !takenCodes.has(code.code))}
          onAdd={(code) => {
            records.addDiagnosis(current.id, { code: code.code, description: code.description })
            toast.success(`${code.code} added as pointer ${current.diagnoses.length + 1}`)
          }}
          onClose={() => setAddingDiagnosis(false)}
        />
      )}

      <ConfirmDialog
        open={removingDiagnosis !== null}
        onOpenChange={(open) => {
          if (!open) setRemovingDiagnosis(null)
        }}
        title={`Remove ${removingDiagnosis === null ? '' : (current.diagnoses[removingDiagnosis]?.code ?? '')}?`}
        description="Pointers after it move up by one. Visits already received keep their snapshot."
        confirmLabel="Remove diagnosis"
        tone="destructive"
        onConfirm={() => {
          if (removingDiagnosis !== null) records.removeDiagnosis(current.id, removingDiagnosis)
          setRemovingDiagnosis(null)
        }}
      />

      {addingAuth && (
        <AuthorizationDialog
          issuers={caseCoverages.map((coverage) => ({
            value: coverage.id,
            label: `${insuranceOf(coverage)?.name ?? 'Insurance'} (${coverage.id === current.primaryCoverageId ? 'primary' : 'secondary'})`,
          }))}
          onSave={(values) => {
            records.addAuthorization(current.id, toAuthorizationValues(values))
            toast.success(`Authorization ${values.number} saved`)
          }}
          onClose={() => setAddingAuth(false)}
        />
      )}

      <ConfirmDialog
        open={deletingAuth !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingAuth(null)
        }}
        title={`Delete authorization ${deletingAuth?.number ?? ''}?`}
        description="It will no longer be available to visits."
        confirmLabel="Delete authorization"
        tone="destructive"
        onConfirm={() => {
          if (deletingAuth !== null) records.removeAuthorization(deletingAuth.id)
          setDeletingAuth(null)
        }}
      />
    </>
  )
}

/** A small icon button beside a diagnosis, in the row actions' style. */
function IconAction({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Button
      size="xs"
      icon={children}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    />
  )
}
