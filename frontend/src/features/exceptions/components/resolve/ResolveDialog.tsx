import type { ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Spinner } from '@/components/ui/Spinner'
import { useInsurances } from '@/features/admin-insurances'
import { useProcedureCodes } from '@/features/admin-procedure-codes'
import { useProviders } from '@/features/admin-providers'
import { useReferringPhysicians } from '@/features/admin-referring-physicians'
import { usePatient, usePatientRecords, type Patient } from '@/features/patients'
import { useVisit, type Visit } from '@/features/visits'
import { resolutionOf, type BillingException } from '../../model/billing-exception'
import { useRecheck } from '../use-recheck'
import { FeeFix, ProviderNpiFix } from './BillingFixes'
import { CaseFix, ReferrerFix, SubscriberFix } from './CaseFixes'
import { AddressFix, LengthFix, PhoneFix } from './PatientFixes'

/**
 * Resolve: the prototype's fix form for the exception's reason, on the record
 * the problem is in. Saving edits that record; then the server re-checks it
 * (a reprocess — a save of a provider, referring physician or fee checks
 * nothing on its own) and the toast says what it found: cleared, or still
 * there. Reasons with no form are not offered here: the list opens their
 * record instead (model/billing-exception.ts `resolutionOf`).
 */
export function ResolveDialog({ exception, onClose }: { exception: BillingException; onClose: () => void }) {
  const recheck = useRecheck()
  const records = usePatientRecords()
  const providers = useProviders()
  const referrers = useReferringPhysicians()
  const codes = useProcedureCodes()
  const insurances = useInsurances()

  const done = (label: string) => {
    onClose()
    void recheck(exception, label)
  }

  const resolution = resolutionOf(exception)
  if (resolution.kind !== 'form') return null
  const item = records.cases.find((entry) => entry.id === exception.caseId)
  const caseCoverages = records.coverages.filter((coverage) => coverage.caseId === exception.caseId)
  const missingCase = <Unavailable loading={!records.ready} onClose={onClose} />

  switch (resolution.form) {
    case 'patient-phone':
    case 'patient-address':
    case 'patient-length': {
      const Fix =
        resolution.form === 'patient-phone'
          ? PhoneFix
          : resolution.form === 'patient-address'
            ? AddressFix
            : LengthFix
      if (exception.patientId === null) return <Unavailable loading={false} onClose={onClose} />
      return (
        <PatientFixLoader patientId={exception.patientId} onClose={onClose}>
          {(patient) => <Fix exception={exception} patient={patient} onDone={done} onClose={onClose} />}
        </PatientFixLoader>
      )
    }
    case 'case-injury-date':
    case 'case-referrer':
      if (item === undefined) return missingCase
      return (
        <CaseFix
          exception={exception}
          item={item}
          missing={resolution.form === 'case-injury-date' ? 'injuryDate' : 'referrer'}
          onDone={done}
          onClose={onClose}
        />
      )
    case 'referrer-npi': {
      if (item === undefined) return missingCase
      const referrer = referrers.data?.find((entry) => entry.id === item.referrerId)
      if (referrer === undefined) return <Unavailable loading={referrers.isPending} onClose={onClose} />
      return (
        <ReferrerFix
          exception={exception}
          referrer={referrer}
          item={item}
          onDone={(label) => done(label)}
          onClose={onClose}
        />
      )
    }
    case 'subscriber': {
      // The insurance whose subscriber lacks a date of birth or gender; else the primary.
      const coverage =
        caseCoverages.find(
          (entry) =>
            entry.subscriber !== null && (entry.subscriber.dob === '' || entry.subscriber.gender === ''),
        ) ?? caseCoverages[0]
      if (coverage === undefined) return missingCase
      return <SubscriberFix exception={exception} coverage={coverage} onDone={done} onClose={onClose} />
    }
    case 'provider-npi':
    case 'fee':
      if (exception.visitId === null) return <Unavailable loading={false} onClose={onClose} />
      return (
        <VisitFixLoader visitId={exception.visitId} onClose={onClose}>
          {(visit) => {
            if (resolution.form === 'provider-npi') {
              const provider = providers.data?.find((entry) => entry.id === visit.treatingProviderId)
              if (provider === undefined)
                return <Unavailable loading={providers.isPending} onClose={onClose} />
              return (
                <ProviderNpiFix exception={exception} provider={provider} onDone={done} onClose={onClose} />
              )
            }
            const line = visit.chargeLines.find((entry) => entry.id === exception.chargeLineId)
            const code = codes.data?.find((entry) => entry.id === line?.procedureCodeId)
            if (code === undefined) return <Unavailable loading={codes.isPending} onClose={onClose} />
            const primary = caseCoverages.find((entry) => entry.rank === 1)
            const insurance = insurances.data?.find((entry) => entry.id === primary?.insuranceId)
            if (primary !== undefined && insurances.isPending)
              return <Unavailable loading onClose={onClose} />
            return (
              <FeeFix
                exception={exception}
                code={code}
                insurance={insurance === undefined ? null : { id: insurance.id, name: insurance.name }}
                onDone={done}
                onClose={onClose}
              />
            )
          }}
        </VisitFixLoader>
      )
  }
}

/** A patient fix starts from the patient's whole record, as the server has it now. */
function PatientFixLoader({
  patientId,
  onClose,
  children,
}: {
  patientId: string
  onClose: () => void
  children: (patient: Patient) => ReactNode
}) {
  const patient = usePatient(patientId)
  if (patient.data === undefined) return <Unavailable loading={patient.isPending} onClose={onClose} />
  return <>{children(patient.data)}</>
}

/** A visit's fix — its treating provider, or a line's code — starts from the visit as it is now. */
function VisitFixLoader({
  visitId,
  onClose,
  children,
}: {
  visitId: number
  onClose: () => void
  children: (visit: Visit) => ReactNode
}) {
  const visit = useVisit(visitId)
  if (visit.data === undefined) return <Unavailable loading={visit.isPending} onClose={onClose} />
  return <>{children(visit.data)}</>
}

/** While the record the fix edits is loading — or when it is no longer there. */
function Unavailable({ loading, onClose }: { loading: boolean; onClose: () => void }) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title="Resolve exception"
      size="sm"
      footer={<Button onClick={onClose}>Close</Button>}
    >
      {loading ? (
        <div className="grid place-items-center py-6">
          <Spinner size={20} />
          <span className="sr-only">Loading</span>
        </div>
      ) : (
        <p className="text-meta text-n600">The record this exception points to could not be found.</p>
      )}
    </Dialog>
  )
}
