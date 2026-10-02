import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { toast } from '@/stores/toast-store'
import { Button } from '@/components/ui/Button'
import { KeyValue } from '@/components/ui/KeyValue'
import { formatIsoDate, todayIso } from '@/lib/utils/dates'
import { usePatientRecords } from '../../data/patient-records-store'
import { addressLine, ageOn, maskSsn } from '../../model/patient'
import { toPatientValues } from '../../schemas/patient-form'
import { PatientDialog } from '../PatientDialog'
import { CardGroup, ChartCard } from './ChartCard'

/**
 * The chart's Profile, with the prototype's groups: Demographics (with "Edit
 * patient"), Contact & address, and Guarantor (with the guarantor's address and
 * the internal notes) — one card, a group each, "Edit patient" at its top since
 * it edits them all. Contact & address and Guarantor sit side by side from
 * 1280px so the page is shorter to scroll.
 *
 * The SSN is only ever shown masked. The prototype lets a System Admin reveal
 * it; there is no permission model here to know who that is, so nobody can.
 * Not built: the prototype's History (the record's own audit trail) and its
 * billing-exception notice — neither exists here yet.
 */
export function ProfileSection({ patientId }: { patientId: string }) {
  const records = usePatientRecords()
  const [editing, setEditing] = useState(false)
  const patient = records.patients.find((item) => item.id === patientId)
  if (patient === undefined) return null

  const { address, guarantor } = patient

  return (
    <>
      <ChartCard
        id="profile"
        className="mt-6"
        title="Profile"
        aside={
          <Button size="sm" icon={<Pencil size={14} aria-hidden="true" />} onClick={() => setEditing(true)}>
            Edit patient
          </Button>
        }
      >
        <CardGroup title="Demographics" description="Required for billing: date of birth, gender, address">
          <KeyValue
            className="max-sm:grid-cols-2"
            items={[
              {
                label: 'Name',
                value: [patient.firstName, patient.middleName, patient.lastName].filter(Boolean).join(' '),
              },
              {
                label: 'Date of birth',
                value: `${formatIsoDate(patient.dob)} (${ageOn(patient.dob, todayIso())} years)`,
              },
              { label: 'Gender', value: patient.gender },
              {
                label: 'SSN',
                value:
                  patient.ssn === '' ? (
                    ''
                  ) : (
                    <>
                      {maskSsn(patient.ssn)} <span className="text-micro text-n500">(masked)</span>
                    </>
                  ),
              },
              { label: 'Billing ID', value: patient.billingId === null ? '' : String(patient.billingId) },
              { label: 'EMR ID (sync key)', value: patient.emrId === null ? '' : String(patient.emrId) },
            ]}
          />
        </CardGroup>

        {/* Contact and guarantor side by side from 1280px; a hairline sets
            them off from the demographics. */}
        <div className="border-rule-row mt-4 grid border-t xl:grid-cols-2 xl:gap-x-10">
          <CardGroup title="Contact & address">
            <KeyValue
              className="max-sm:grid-cols-2 xl:grid-cols-2"
              items={[
                { label: 'Cell phone', value: patient.phoneCell },
                { label: 'Home phone', value: patient.phoneHome },
                { label: 'Email', value: patient.email },
                {
                  label: 'Address',
                  value: (
                    <>
                      {[address.line1, address.line2].filter(Boolean).join(', ')}
                      <br />
                      {address.city}, {address.state} {address.zip}
                    </>
                  ),
                },
              ]}
            />
          </CardGroup>

          <CardGroup title="Guarantor" className="border-rule-row mt-4 border-t xl:mt-0 xl:border-t-0">
            <KeyValue
              className="max-sm:grid-cols-2 xl:grid-cols-2"
              items={[
                {
                  label: 'Guarantor',
                  value:
                    guarantor === null ? (
                      'The patient'
                    ) : (
                      <>
                        {guarantor.name} ({guarantor.relationship})
                        <span className="text-micro text-n500 block">{addressLine(guarantor.address)}</span>
                      </>
                    ),
                },
                {
                  label: 'Internal notes',
                  value:
                    patient.notes === '' ? '' : <span className="whitespace-pre-line">{patient.notes}</span>,
                },
              ]}
            />
          </CardGroup>
        </div>
      </ChartCard>

      {editing && (
        <PatientDialog
          patient={patient}
          defaultPracticeId={String(patient.practiceId)}
          onSave={(values) => {
            records.updatePatient(patient.id, toPatientValues(values, patient.practiceId))
            toast.success('Patient saved')
          }}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  )
}
