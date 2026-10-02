import { toast } from '@/stores/toast-store'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Spinner } from '@/components/ui/Spinner'
import { useInsurances } from '@/features/admin-insurances'
import { useProcedureCodes } from '@/features/admin-procedure-codes'
import { useProviders } from '@/features/admin-providers'
import { useReferringPhysicians } from '@/features/admin-referring-physicians'
import { useCurrentUser } from '@/features/auth'
import { usePatientRecords } from '@/features/patients'
import { useBillingExceptions } from '../../data/exceptions-store'
import { fixKey, recordKey, type BillingException } from '../../model/billing-exception'
import { FeeFix, ProviderNpiFix } from './BillingFixes'
import { CaseFix, ReferrerFix, SubscriberFix } from './CaseFixes'
import { AddressFix, LengthFix, PhoneFix } from './PatientFixes'

const pad = (value: number) => String(value).padStart(2, '0')
/** Now, as a local ISO date and time — how the list stamps "Resolved". */
function stampNow(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
}

/**
 * Resolve: the prototype's fix form for the exception's kind, on the record
 * the problem is in. Saving edits that record, then the exceptions the fix
 * settles are resolved, and a toast says so — or that the same visit still
 * has others.
 */
export function ResolveDialog({ exception, onClose }: { exception: BillingException; onClose: () => void }) {
  const list = useBillingExceptions()
  const user = useCurrentUser()
  const records = usePatientRecords()
  const providers = useProviders()
  const referrers = useReferringPhysicians()
  const codes = useProcedureCodes()
  const insurances = useInsurances()

  const settle = (label: string, settles: (other: BillingException) => boolean) => {
    const record = recordKey(exception.record)
    const still = list.exceptions.filter(
      (other) => other.status === 'Open' && recordKey(other.record) === record && !settles(other),
    )
    list.resolve(settles, user.data?.name ?? null, stampNow())
    if (still.length > 0)
      toast.warning(
        `${label} — but the visit still has ${still.length === 1 ? '1 exception' : `${still.length} exceptions`}`,
        still.map((other) => other.trigger).join(' · '),
      )
    else toast.success(`${label} — exception resolved`)
    onClose()
  }
  // By default a fix settles every open exception that points at the same fix.
  const done = (label: string) => settle(label, (other) => fixKey(other.fix) === fixKey(exception.fix))

  const fix = exception.fix
  switch (fix.type) {
    case 'patient-phone':
    case 'patient-address':
    case 'patient-length': {
      const patient = records.patients.find((item) => item.id === fix.patientId)
      if (patient === undefined) return <Unavailable loading={!records.ready} onClose={onClose} />
      const Fix =
        fix.type === 'patient-phone' ? PhoneFix : fix.type === 'patient-address' ? AddressFix : LengthFix
      return <Fix exception={exception} patient={patient} onDone={done} onClose={onClose} />
    }
    case 'case': {
      const item = records.cases.find((entry) => entry.id === fix.caseId)
      if (item === undefined) return <Unavailable loading={!records.ready} onClose={onClose} />
      return <CaseFix exception={exception} item={item} missing={fix.field} onDone={done} onClose={onClose} />
    }
    case 'coverage': {
      const coverage = records.coverages.find((entry) => entry.id === fix.coverageId)
      if (coverage === undefined) return <Unavailable loading={!records.ready} onClose={onClose} />
      return <SubscriberFix exception={exception} coverage={coverage} onDone={done} onClose={onClose} />
    }
    case 'referrer': {
      const referrer = referrers.data?.find((entry) => entry.id === fix.referrerId)
      const item = records.cases.find((entry) => entry.id === fix.caseId)
      if (referrer === undefined || item === undefined)
        return <Unavailable loading={referrers.isPending || !records.ready} onClose={onClose} />
      return (
        <ReferrerFix
          exception={exception}
          referrer={referrer}
          item={item}
          onDone={(label, everyCase) =>
            settle(
              label,
              // A corrected directory profile fixes every case that uses the
              // physician; another physician fixes only this case.
              (other) =>
                other.fix.type === 'referrer' &&
                (everyCase ? other.fix.referrerId === fix.referrerId : other.fix.caseId === fix.caseId),
            )
          }
          onClose={onClose}
        />
      )
    }
    case 'provider-npi': {
      const provider = providers.data?.find((entry) => entry.id === fix.providerId)
      if (provider === undefined) return <Unavailable loading={providers.isPending} onClose={onClose} />
      return <ProviderNpiFix exception={exception} provider={provider} onDone={done} onClose={onClose} />
    }
    case 'fee': {
      const code = codes.codes.find((entry) => entry.code === fix.procedureCode)
      if (code === undefined) return <Unavailable loading={!codes.ready} onClose={onClose} />
      const insurance = insurances.data?.find((entry) => entry.id === fix.insuranceId)
      if (fix.insuranceId !== null && insurances.isPending) return <Unavailable loading onClose={onClose} />
      return (
        <FeeFix
          exception={exception}
          code={code}
          insurance={insurance === undefined ? null : { id: insurance.id, name: insurance.name }}
          onDone={done}
          onClose={onClose}
        />
      )
    }
    case 'era-claim':
    case 'carc':
      // Payment-level fixes need claims and remittances; the list offers no Resolve for them.
      return null
  }
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
