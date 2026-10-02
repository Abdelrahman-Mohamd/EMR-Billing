import { useId } from 'react'
import { Link } from '@tanstack/react-router'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button, buttonClass } from '@/components/ui/Button'
import { DateInput } from '@/components/ui/DateInput'
import { Dialog } from '@/components/ui/Dialog'
import { FormGrid, FormNote, FormSection } from '@/components/ui/Field'
import { Form, FormField } from '@/components/ui/Form'
import { Input } from '@/components/ui/Input'
import { SearchSelect } from '@/components/ui/SearchSelect'
import { Select } from '@/components/ui/Select'
import { Switch } from '@/components/ui/Switch'
import type { ReferringPhysician } from '@/features/admin-referring-physicians'
import { todayIso } from '@/lib/utils/dates'
import { isValidNpi } from '@/lib/validation/npi'
import { INJURY_TYPES, type PatientCase } from '../../model/case'
import { caseFormSchema, newCaseValues, toCaseFormValues, type CaseFormValues } from '../../schemas/case-form'

export interface CoverageOption {
  value: string
  label: string
  /** What the coverage's insurance requires. */
  injuryDateRequired: boolean
  isWorkersComp: boolean
  /** Its insurance's name, for the injury-date help ("{name} requires it"). */
  insuranceName: string
}

/**
 * New or edit a case, in the prototype's layout: case name and referring
 * physician; Insurance — the primary and optional secondary, chosen from the
 * patient's coverage; Injury & dates — related cause, injury / onset date,
 * accident state, employment status, start of care, discharge date; and
 * whether the case is open.
 *
 * As in the prototype, the injury date and accident state wait for a related
 * cause (the injury date stays open when the primary insurance requires it),
 * and closing them clears them. When the practice has no referring physicians,
 * or the patient no insurance, the form says where to add them.
 */
export function CaseDialog({
  item,
  referrers,
  coverageOptions,
  onSave,
  onClose,
  onShowInsurance,
}: {
  /** `null` adds a case. */
  item: PatientCase | null
  /** The practice's referring physicians. */
  referrers: readonly ReferringPhysician[]
  /** The patient's coverage, "Aetna · member W2840…". */
  coverageOptions: readonly CoverageOption[]
  onSave: (values: CaseFormValues, injuryDateRequired: boolean) => void
  onClose: () => void
  /** Closes the form and goes to the patient's insurance list, on the chart. */
  onShowInsurance: () => void
}) {
  const formId = useId()
  const today = todayIso()
  const optionOf = (id: string | null) => coverageOptions.find((option) => option.value === id)
  const form = useForm<CaseFormValues>({
    resolver: zodResolver(
      caseFormSchema({
        injuryDateRequired: (id) => optionOf(id)?.injuryDateRequired ?? false,
        isWorkersComp: (id) => optionOf(id)?.isWorkersComp ?? false,
      }),
    ),
    defaultValues: item === null ? newCaseValues(today) : toCaseFormValues(item),
  })
  const [injuryType, primaryCoverageId] = useWatch({
    control: form.control,
    name: ['injuryType', 'primaryCoverageId'],
  })
  const primary = optionOf(primaryCoverageId)
  const cause = injuryType !== null && injuryType !== ''
  const injuryDateOpen = cause || (primary?.injuryDateRequired ?? false)

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={item === null ? 'New case' : 'Edit case'}
      description={
        item === null
          ? 'A case is one episode of care, billed to the insurance you choose from the patient’s list. Diagnoses are added to it next.'
          : 'Visits inherit these values.'
      }
      size="lg"
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary">
            {item === null ? 'Create case' : 'Save case'}
          </Button>
        </>
      }
    >
      <Form
        id={formId}
        form={form}
        onSubmit={(values) => {
          onSave(values, optionOf(values.primaryCoverageId)?.injuryDateRequired ?? false)
          onClose()
        }}
      >
        <FormGrid>
          <FormField name="name" label="Case name" required span={6}>
            {(field) => (
              <Input {...field} placeholder="Enter case name, e.g. R shoulder 2026" autoComplete="off" />
            )}
          </FormField>
          <FormField
            name="referrerId"
            label="Referring physician"
            required
            span={6}
            info="Name and NPI go on the claim (Box 17)."
          >
            {(field) => (
              <SearchSelect
                value={typeof field.value === 'string' ? field.value : null}
                onChange={field.onChange}
                options={referrers.map((referrer) => ({
                  value: String(referrer.id),
                  label: `${referrer.name} · NPI ${referrer.npi}${isValidNpi(referrer.npi) ? '' : ' (invalid)'}`,
                }))}
                placeholder="Select a referring physician"
                searchPlaceholder="Search physicians"
              />
            )}
          </FormField>
          {/* Under the row, so the case name and the physician stay side by side. */}
          {referrers.length === 0 && (
            <div className="col-span-12 flex flex-wrap items-center gap-3">
              <FormNote>
                <strong className="font-medium">No referring physicians yet.</strong> A case needs one for
                billing — the name and NPI print in Box 17.
              </FormNote>
              <Link to="/setup/referring-physicians" className={buttonClass('default', 'sm')}>
                Add a referring physician
              </Link>
            </div>
          )}

          <FormSection title="Insurance">
            {coverageOptions.length === 0 && (
              <div className="col-span-12 flex flex-wrap items-center gap-3">
                <FormNote>
                  <strong className="font-medium">This patient has no insurance yet.</strong> Add it to the
                  patient’s insurance list, then choose it here.
                </FormNote>
                <Button size="sm" onClick={onShowInsurance}>
                  Go to the patient’s insurance
                </Button>
              </div>
            )}
            <FormField
              name="primaryCoverageId"
              label="Primary insurance"
              required
              span={6}
              info="From the patient’s insurance list. Claims go here first."
            >
              {(field) => (
                <Select
                  value={typeof field.value === 'string' ? field.value : null}
                  onChange={field.onChange}
                  options={coverageOptions}
                  placeholder="Select the primary insurance"
                />
              )}
            </FormField>
            <FormField
              name="secondaryCoverageId"
              label="Secondary insurance"
              span={6}
              info="Billed after the primary’s remittance posts."
            >
              {(field) => (
                <Select
                  value={typeof field.value === 'string' ? field.value : null}
                  onChange={field.onChange}
                  options={coverageOptions}
                  placeholder="None"
                  clearable
                />
              )}
            </FormField>
          </FormSection>

          <FormSection title="Injury & dates">
            <FormField
              name="injuryType"
              label="Related cause"
              span={4}
              info="Drives Box 10a–c. Leave it empty and all three answer NO; the injury date and accident state follow from it."
            >
              {(field) => (
                <Select
                  value={typeof field.value === 'string' ? field.value : null}
                  onChange={(next) => {
                    field.onChange(next)
                    // Closing a field clears it, as in the prototype.
                    if (next === null) {
                      form.setValue('accidentState', '')
                      if (!(primary?.injuryDateRequired ?? false)) form.setValue('injuryDate', '')
                    }
                  }}
                  options={INJURY_TYPES.map((value) => ({ value, label: value }))}
                  placeholder="Not related to an injury"
                  clearable
                />
              )}
            </FormField>
            <FormField
              name="injuryDate"
              label="Injury / onset date"
              span={4}
              required={injuryDateOpen}
              disabled={!injuryDateOpen}
              info={
                primary?.injuryDateRequired === true
                  ? `${primary.insuranceName} requires it (Box 14).`
                  : 'Box 14.'
              }
            >
              {(field) => (
                <DateInput
                  value={typeof field.value === 'string' ? field.value : ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  max={today}
                  disabled={!injuryDateOpen}
                />
              )}
            </FormField>
            <FormField
              name="accidentState"
              label="Accident state"
              span={4}
              required={injuryType === 'Auto'}
              disabled={!cause}
              info="Box 10b when auto related."
            >
              {(field) => <Input {...field} placeholder="Enter state" maxLength={2} disabled={!cause} />}
            </FormField>
            <FormField
              name="employmentStatus"
              label="Employment status"
              span={6}
              required={primary?.isWorkersComp ?? false}
            >
              {(field) => (
                <Input {...field} placeholder="Enter status, e.g. Employed full time" autoComplete="off" />
              )}
            </FormField>
            <FormField name="startOfCare" label="Start of care" span={3}>
              {(field) => (
                <DateInput
                  value={typeof field.value === 'string' ? field.value : ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            </FormField>
            <FormField name="dischargeDate" label="Discharge date" span={3}>
              {(field) => (
                <DateInput
                  value={typeof field.value === 'string' ? field.value : ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            </FormField>
            <div className="col-span-12">
              <FormField name="isActive">
                {(field) => (
                  <Switch
                    label="Case is open"
                    name={field.name}
                    checked={field.value === true}
                    onCheckedChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              </FormField>
            </div>
          </FormSection>
        </FormGrid>
      </Form>
    </Dialog>
  )
}
