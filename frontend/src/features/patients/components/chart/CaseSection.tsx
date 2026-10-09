import { useState, type ReactNode } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react'
import { isApiError, userMessage } from '@/lib/api/api-error'
import { toast } from '@/stores/toast-store'
import { Badge, Tag } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { CellSub, DataTable, type Column } from '@/components/ui/DataTable'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { KeyValue } from '@/components/ui/KeyValue'
import { RowActionButton, RowActions, actionsColumn } from '@/components/ui/RowActions'
import { useInsuranceClasses, useInsurances, type Insurance } from '@/features/admin-insurances'
import { useReferringPhysicians } from '@/features/admin-referring-physicians'
import { cn } from '@/lib/utils/cn'
import { formatIsoDate, todayIso } from '@/lib/utils/dates'
import { usePatientRecords } from '../../data/patient-records-store'
import { AUTH_UNITS, authStatus, type Authorization } from '../../model/authorization'
import { MAX_DIAGNOSES, injuryTypeName, type PatientCase } from '../../model/case'
import { coveragesOf, primaryOf, rankName, type Coverage } from '../../model/coverage'
import { effectiveRule } from '../../model/insurance-rules'
import { casesOf, leadCase } from '../../model/roster'
import {
  useCreateAuthorization,
  useDeleteAuthorization,
  useUpdateAuthorization,
} from '../../queries/use-authorizations'
import { useDeletePatientCase, useSetCaseDiagnoses } from '../../queries/use-patient-cases'
import { toAuthorizationPayload, toAuthorizationUpdatePayload } from '../../schemas/authorization-form'
import { AuthorizationDialog } from './AuthorizationDialog'
import { CaseEditor } from './CaseEditor'
import { DiagnosisDialog } from './DiagnosisDialog'
import { InsuranceSection } from './InsuranceSection'
import { CardEmpty, CardGroup, ChartCard } from './ChartCard'
import { SCROLL_MARGIN } from './chart-scroll'

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
 * The authorizations are the server's (contract 2026-10-09): added, edited and
 * deleted there, each issued by one of the case's insurances; what visits have
 * used and what is left are the server's counts.
 */
export function CaseSection({ patientId, caseId }: { patientId: string; caseId: string | undefined }) {
  const navigate = useNavigate()
  const records = usePatientRecords()
  const setDiagnoses = useSetCaseDiagnoses()
  const removeCase = useDeletePatientCase()
  const [deletingCase, setDeletingCase] = useState(false)
  const insurances = useInsurances()
  const classes = useInsuranceClasses()
  const referrers = useReferringPhysicians()
  const [editing, setEditing] = useState<PatientCase | null | undefined>(undefined)
  const [addingDiagnosis, setAddingDiagnosis] = useState(false)
  const [removingDiagnosis, setRemovingDiagnosis] = useState<number | null>(null)
  /** `undefined`: no dialog. `null`: adding. An authorization: editing it. */
  const [editingAuth, setEditingAuth] = useState<Authorization | null | undefined>(undefined)
  const [deletingAuth, setDeletingAuth] = useState<Authorization | null>(null)
  const createAuth = useCreateAuthorization()
  const updateAuth = useUpdateAuthorization()
  const removeAuth = useDeleteAuthorization()

  const patient = records.patients.find((item) => item.id === patientId)
  if (patient === undefined) return null

  const cases = casesOf(records.cases, patient.id)
  const current = cases.find((item) => item.id === caseId) ?? leadCase(cases)
  const allInsurances = insurances.data ?? []
  const practiceClasses = (classes.data ?? []).filter((item) => item.practiceId === patient.practiceId)
  const practiceReferrers = (referrers.data ?? []).filter((item) => item.practiceId === patient.practiceId)
  const insuranceOf = (coverage: Coverage | undefined): Insurance | undefined =>
    coverage === undefined ? undefined : allInsurances.find((item) => item.id === coverage.insuranceId)
  const coverageById = (id: string) => records.coverages.find((coverage) => coverage.id === id)
  const caseDialog =
    editing === undefined ? null : (
      <CaseEditor patientId={patient.id} item={editing} onClose={() => setEditing(undefined)} />
    )

  // The case part opens on the case it shows, so what follows is plainly its.
  // Switching and starting a case are on the chart's case card.
  const header = (
    <div id="case" className={SCROLL_MARGIN}>
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
              primaryOf(records.coverages, current.id)?.insuranceName || 'No insurance',
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

  const primaryInsurance = insuranceOf(primaryOf(records.coverages, current.id))
  const caseCoverages = coveragesOf(records.coverages, current.id)
  const referrer = practiceReferrers.find((item) => item.id === current.referrerId)
  const injuryDateNeeded =
    current.injuryType !== '' || effectiveRule(primaryInsurance, practiceClasses, 'injuryDateRequired')
  const authNeeded = caseCoverages.some((coverage) =>
    effectiveRule(insuranceOf(coverage), practiceClasses, 'authorizationRequired'),
  )
  const auths = records.authorizations.filter((auth) => auth.caseId === current.id)
  const today = todayIso()

  /** The diagnoses, in pointer order, saved on the server: the whole list each time. */
  const saveDiagnoses = async (codes: readonly string[], done: string) => {
    try {
      const message = await setDiagnoses.mutateAsync({ id: current.id, codes })
      toast.success(done, message ?? undefined)
    } catch (error) {
      toast.error(
        'The diagnoses were not saved',
        isApiError(error) ? userMessage(error) : 'Something went wrong. Please try again.',
      )
    }
  }
  const codes = current.diagnoses.map((diagnosis) => diagnosis.code)
  const moved = (index: number, direction: -1 | 1) => {
    const next = [...codes]
    const [a, b] = [next[index], next[index + direction]]
    if (a === undefined || b === undefined) return next
    next[index] = b
    next[index + direction] = a
    return next
  }

  const authColumns: ReadonlyArray<Column<Authorization>> = [
    {
      key: 'number',
      header: 'Authorization #',
      primary: true,
      cell: (auth) => (
        <span className="block">
          <span className="break-words tabular-nums">{auth.number}</span>
        </span>
      ),
    },
    {
      key: 'issuer',
      header: 'Issued by',
      cell: (auth) => {
        const coverage = coverageById(auth.coverageId)
        return (
          <>
            <span className="break-words">{auth.insuranceName || coverage?.insuranceName || '—'}</span>
            {coverage !== undefined && <CellSub>{rankName(coverage)}</CellSub>}
          </>
        )
      },
    },
    {
      key: 'dates',
      header: 'Active dates',
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
      cell: (auth) => (
        <span className="whitespace-nowrap tabular-nums">
          {auth.qty} {unitName(auth).toLowerCase()}
        </span>
      ),
    },
    {
      key: 'used',
      header: 'Used',
      cell: (auth) => <span className="tabular-nums">{auth.used}</span>,
    },
    {
      key: 'remaining',
      header: 'Remaining',
      cell: (auth) => (
        <span className={cn('tabular-nums', auth.remaining > 0 ? 'text-ink font-medium' : 'text-critical')}>
          {auth.remaining}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (auth) => {
        const status = authStatus(auth, today)
        return <Badge tone={status.tone}>{status.label}</Badge>
      },
    },
    actionsColumn<Authorization>((auth) => (
      <RowActions>
        <RowActionButton
          action="edit"
          label={`Edit authorization ${auth.number}`}
          onClick={() => setEditingAuth(auth)}
        />
        <RowActionButton
          action="delete"
          label={`Delete authorization ${auth.number}`}
          onClick={() => setDeletingAuth(auth)}
        />
      </RowActions>
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
        info="Every visit on this case inherits its referring physician, diagnoses, injury type and onset date."
        aside={
          <>
            <Button
              size="sm"
              icon={<Pencil size={14} aria-hidden="true" />}
              onClick={() => setEditing(current)}
            >
              Edit case
            </Button>
            <Button
              size="sm"
              variant="danger"
              icon={<Trash2 size={14} aria-hidden="true" />}
              onClick={() => setDeletingCase(true)}
            >
              Delete case
            </Button>
          </>
        }
      >
        {/* Two groups side by side from 768px, each read top to bottom. */}
        <div className="grid gap-y-7 pt-4 md:grid-cols-2 md:gap-x-10">
          <CardGroup title="Referral & care">
            <KeyValue
              layout="rows"
              items={[
                referrer === undefined
                  ? { label: 'Referring physician', value: required }
                  : {
                      label: 'Referring physician',
                      value: referrer.name,
                      sub: `${referrer.type === 'DQ' ? 'Supervising (DQ)' : 'Referring (DN)'} · NPI ${referrer.npi}`,
                    },
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
          </CardGroup>
          <CardGroup title="Injury">
            <KeyValue
              layout="rows"
              items={[
                { label: 'Related cause', value: injuryTypeName(current) || 'Not related to an injury' },
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
              ]}
            />
          </CardGroup>
        </div>
      </ChartCard>

      <InsuranceSection patient={patient} caseItem={current} />

      <ChartCard
        className="mt-4"
        id="diagnoses"
        headingLevel={3}
        title="Diagnoses"
        meta={`${current.diagnoses.length} of ${MAX_DIAGNOSES}`}
        info="The case’s ICD-10 codes, in order: the position is the diagnosis pointer on the claim (Box 21 / 24E). Each visit copies these codes when it arrives, so later edits here never change a claim already billed."
        aside={
          <Button
            size="sm"
            icon={<Plus size={14} aria-hidden="true" />}
            onClick={() => {
              if (current.diagnoses.length >= MAX_DIAGNOSES) {
                toast.warning('A case holds up to 12 diagnoses', 'Delete one before adding another.')
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
          <CardEmpty title="No diagnoses on this case">
            At least one ICD-10 code is needed before a claim can point to it.
          </CardEmpty>
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
                    onClick={() => void saveDiagnoses(moved(index, -1), `${diagnosis.code} moved up`)}
                  >
                    <ArrowUp size={14} aria-hidden="true" />
                  </IconAction>
                  <IconAction
                    label={`Move ${diagnosis.code} down`}
                    disabled={index === current.diagnoses.length - 1}
                    onClick={() => void saveDiagnoses(moved(index, 1), `${diagnosis.code} moved down`)}
                  >
                    <ArrowDown size={14} aria-hidden="true" />
                  </IconAction>
                  <RowActionButton
                    action="delete"
                    label={`Delete ${diagnosis.code}`}
                    onClick={() => setRemovingDiagnosis(index)}
                  />
                </span>
              </li>
            ))}
          </ol>
        )}
      </ChartCard>

      <ChartCard
        className="mt-4"
        id="authorizations"
        headingLevel={3}
        title="Authorizations"
        info="A payer’s approval for a number of visits or units between two dates. When the primary insurance requires one, visits without it are pended."
        meta={
          authNeeded ? (
            <Tag tone="attention">Required by the primary insurance</Tag>
          ) : (
            'Not required by the primary insurance'
          )
        }
        aside={
          caseCoverages.length > 0 ? (
            <Button
              size="sm"
              icon={<Plus size={14} aria-hidden="true" />}
              onClick={() => setEditingAuth(null)}
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
            <CardEmpty title="No authorizations recorded">
              {authNeeded
                ? 'Add the payer’s approval to release pended visits and held claims.'
                : 'This payer does not require one.'}
            </CardEmpty>
          }
        />
      </ChartCard>

      {caseDialog}

      {addingDiagnosis && (
        <DiagnosisDialog
          pointer={current.diagnoses.length + 1}
          codes={records.icd10.filter((code) => !takenCodes.has(code.code))}
          onAdd={(code) =>
            void saveDiagnoses(
              [...codes, code.code],
              `${code.code} added as pointer ${current.diagnoses.length + 1}`,
            )
          }
          onClose={() => setAddingDiagnosis(false)}
        />
      )}

      <ConfirmDialog
        open={removingDiagnosis !== null}
        onOpenChange={(open) => {
          if (!open) setRemovingDiagnosis(null)
        }}
        title={`Delete ${removingDiagnosis === null ? '' : (current.diagnoses[removingDiagnosis]?.code ?? '')}?`}
        description="It is taken off this case; pointers after it move up by one. Visits already received keep their snapshot."
        confirmLabel="Delete diagnosis"
        tone="destructive"
        onConfirm={async () => {
          if (removingDiagnosis === null) return
          const removed = codes[removingDiagnosis] ?? ''
          await saveDiagnoses(
            codes.filter((_, position) => position !== removingDiagnosis),
            `${removed} deleted`,
          )
          setRemovingDiagnosis(null)
        }}
      />

      <ConfirmDialog
        open={deletingCase}
        onOpenChange={setDeletingCase}
        title={`Delete the case ${current.name}?`}
        description="Its diagnoses and authorizations go with it. This cannot be undone."
        confirmLabel="Delete case"
        tone="destructive"
        onConfirm={async () => {
          try {
            const message = await removeCase.mutateAsync(current.id)
            toast.success(message ?? 'Case deleted')
            // The chart shows the patient's next case.
            void navigate({
              to: '/patients/$patientId',
              params: { patientId: patient.id },
              search: {},
              resetScroll: false,
            })
          } catch (error) {
            toast.error(
              `${current.name} was not deleted`,
              isApiError(error) ? userMessage(error) : 'Something went wrong. Please try again.',
            )
          }
        }}
      />

      {editingAuth !== undefined && (
        <AuthorizationDialog
          key={editingAuth?.id ?? 'new'}
          authorization={editingAuth}
          issuers={caseCoverages.map((coverage) => ({
            value: coverage.id,
            label: `${coverage.insuranceLabel || coverage.insuranceName || 'Insurance'} (${rankName(coverage).toLowerCase()})`,
          }))}
          onSave={async (values) => {
            const message =
              editingAuth === null
                ? await createAuth.mutateAsync(toAuthorizationPayload(values))
                : await updateAuth.mutateAsync({
                    id: editingAuth.id,
                    payload: toAuthorizationUpdatePayload(values),
                  })
            toast.success(message ?? `Authorization ${values.number} saved`)
          }}
          onClose={() => setEditingAuth(undefined)}
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
        onConfirm={async () => {
          if (deletingAuth === null) return
          try {
            const message = await removeAuth.mutateAsync(deletingAuth.id)
            toast.success(message ?? `Authorization ${deletingAuth.number} deleted`)
          } catch (error) {
            toast.error(
              `Authorization ${deletingAuth.number} was not deleted`,
              isApiError(error) ? userMessage(error) : 'Something went wrong. Please try again.',
            )
          }
        }}
      />
    </>
  )
}

const unitName = (auth: Authorization) =>
  AUTH_UNITS.find((unit) => unit.value === auth.unit)?.label ?? auth.unit

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
