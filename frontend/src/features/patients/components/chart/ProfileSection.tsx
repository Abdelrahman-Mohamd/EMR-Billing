import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { KeyValue } from '@/components/ui/KeyValue'
import { formatIsoDate, todayIso } from '@/lib/utils/dates'
import { ageOn, genderName, showPhone, type Patient } from '../../model/patient'
import { usePatientWrites } from '../../queries/use-patients'
import { PatientDialog } from '../PatientDialog'
import { CardGroup, ChartCard } from './ChartCard'

/**
 * The chart's Profile, with the prototype's groups: Demographics, Contact &
 * address, Guarantor (who receives the statements, and whether they are sent)
 * and the Internal notes — one card, a group each, "Edit patient" at its top
 * since it edits them all. Each group is a two-column table, two groups side
 * by side from 768px. A value's own details (a relationship, a birth date) sit
 * on a quieter line under it; an address is one value on two lines.
 *
 * The record is the server's, as the chart read it. The SSN is only ever shown
 * masked — the server never sends it whole. Not built: the prototype's History
 * (the record's own audit trail) and its billing-exception notice — neither
 * exists here yet.
 */
export function ProfileSection({ patient }: { patient: Patient }) {
  const writes = usePatientWrites()
  const [editing, setEditing] = useState(false)
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
        {/* Two by two where the card is wide enough — Demographics beside Contact &
            address, then Guarantor beside the notes — the rows lined up, so the
            columns hold about as much; one column on a phone. */}
        <div className="@container">
          <div className="grid gap-y-7 pt-4 @xl:grid-cols-2 @xl:gap-x-10">
            <CardGroup title="Demographics">
              <KeyValue
                layout="rows"
                items={[
                  {
                    label: 'Name',
                    value: [patient.firstName, patient.middleName, patient.lastName]
                      .filter(Boolean)
                      .join(' '),
                  },
                  {
                    label: 'Date of birth',
                    value: (
                      <>
                        {formatIsoDate(patient.dob)}
                        <span className="text-n500"> · {ageOn(patient.dob, todayIso())} years</span>
                      </>
                    ),
                  },
                  { label: 'Gender', value: genderName(patient) },
                  { label: 'SSN', value: patient.maskedSsn },
                  { label: 'Billing ID', value: String(patient.billingId) },
                  {
                    label: 'EMR ID',
                    value: patient.emrId === null ? '' : String(patient.emrId),
                  },
                ]}
              />
            </CardGroup>

            <CardGroup title="Contact & address">
              <KeyValue
                layout="rows"
                items={[
                  { label: 'Cell phone', value: showPhone(patient.phoneCell) },
                  { label: 'Home phone', value: showPhone(patient.phoneHome) },
                  { label: 'Email', value: patient.email },
                  {
                    label: 'Address',
                    value: (
                      <>
                        <span className="block">
                          {[address.line1, address.line2].filter(Boolean).join(', ')}
                        </span>
                        <span className="block">{`${address.city}, ${address.state} ${address.zip}`}</span>
                      </>
                    ),
                  },
                ]}
              />
            </CardGroup>

            <CardGroup title="Guarantor">
              <KeyValue
                layout="rows"
                items={[
                  guarantor === null
                    ? { label: 'Responsible party', value: 'The patient' }
                    : {
                        label: 'Responsible party',
                        value: `${guarantor.firstName} ${guarantor.lastName}`.trim(),
                        sub: [
                          guarantor.relationship,
                          guarantor.dob === '' ? '' : `born ${formatIsoDate(guarantor.dob)}`,
                        ]
                          .filter(Boolean)
                          .join(' · '),
                      },
                  { label: 'Statements', value: patient.noStatements ? 'Not sent' : 'Sent' },
                  ...(guarantor?.address === undefined || guarantor.address === null
                    ? []
                    : [
                        {
                          label: 'Guarantor address',
                          value: (
                            <>
                              <span className="block">{guarantor.address.line1}</span>
                              <span className="block">{`${guarantor.address.city}, ${guarantor.address.state} ${guarantor.address.zip}`}</span>
                            </>
                          ),
                        },
                      ]),
                ]}
              />
            </CardGroup>

            {/* The notes are the staff's own, about the patient: a group of their own. */}
            <CardGroup title="Internal notes">
              {/* The group's title names them: no label of their own. */}
              {patient.notes === '' ? (
                <p className="border-rule-row text-meta text-n400 border-b py-2">
                  <span aria-hidden="true">—</span>
                  <span className="sr-only">None</span>
                </p>
              ) : (
                <p className="border-rule-row text-meta text-ink border-b py-2 leading-snug break-words whitespace-pre-line">
                  {patient.notes}
                </p>
              )}
            </CardGroup>
          </div>
        </div>
      </ChartCard>

      {editing && (
        <PatientDialog
          patient={patient}
          defaultPracticeId={String(patient.practiceId)}
          onSave={(values) => writes.update(patient.id, values)}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  )
}
