import { useId } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/Button'
import { DateInput } from '@/components/ui/DateInput'
import { Dialog } from '@/components/ui/Dialog'
import { FormGrid, FormSection } from '@/components/ui/Field'
import { Form, FormField } from '@/components/ui/Form'
import { Input } from '@/components/ui/Input'
import { SearchSelect } from '@/components/ui/SearchSelect'
import { Select } from '@/components/ui/Select'
import { insuranceLabel, type Insurance } from '@/features/admin-insurances'
import { todayIso } from '@/lib/utils/dates'
import {
  CLAIM_NUMBER_TYPES,
  SUBSCRIBER_RELATIONSHIPS,
  WORKERS_COMP,
  type Coverage,
} from '../../model/coverage'
import {
  coverageFormSchema,
  newCoverageValues,
  toCoverageFormValues,
  type CoverageFormValues,
} from '../../schemas/coverage-form'

/**
 * Add or edit a coverage, in the prototype's sections: the insurance, member
 * ID, group number and claim number; the Subscriber; the Employer (Workers'
 * Comp only).
 *
 * The subscriber's name and date of birth are asked for only when the patient
 * is not the subscriber, and the employer only for a Workers' Comp insurance
 * (the prototype showed them always and required them only then).
 */
export function CoverageDialog({
  coverage,
  insurances,
  onSave,
  onClose,
}: {
  /** `null` adds a coverage. */
  coverage: Coverage | null
  /** The practice's active insurances (and the coverage's own, if it is no longer active). */
  insurances: readonly Insurance[]
  onSave: (values: CoverageFormValues) => void
  onClose: () => void
}) {
  const formId = useId()
  const typeOf = (id: string | null) => insurances.find((item) => String(item.id) === id)?.insuranceType
  const form = useForm<CoverageFormValues>({
    resolver: zodResolver(coverageFormSchema(typeOf)),
    defaultValues: coverage === null ? newCoverageValues() : toCoverageFormValues(coverage),
  })
  const [insuranceId, relationship] = useWatch({
    control: form.control,
    name: ['insuranceId', 'subscriberRelationship'],
  })
  const type = typeOf(insuranceId)
  const needsClaimNumber = type !== undefined && (CLAIM_NUMBER_TYPES as readonly string[]).includes(type)

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={coverage === null ? 'Add coverage' : 'Edit coverage'}
      {...(coverage === null
        ? {
            description:
              'Adds an insurance policy to the patient’s list. Choose it on a case as the primary or secondary insurance.',
          }
        : {})}
      size="lg"
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary">
            {coverage === null ? 'Add coverage' : 'Save coverage'}
          </Button>
        </>
      }
    >
      <Form
        id={formId}
        form={form}
        onSubmit={(values) => {
          onSave(values)
          onClose()
        }}
      >
        <FormGrid>
          <FormField name="insuranceId" label="Insurance" required span={12}>
            {(field) => (
              <SearchSelect
                value={typeof field.value === 'string' ? field.value : null}
                onChange={field.onChange}
                options={insurances.map((item) => ({ value: String(item.id), label: insuranceLabel(item) }))}
                placeholder="Select an insurance"
                searchPlaceholder="Search insurances"
              />
            )}
          </FormField>
          <FormField name="memberId" label="Member ID" required span={4}>
            {(field) => <Input {...field} placeholder="Enter member ID, as on the card" autoComplete="off" />}
          </FormField>
          <FormField name="groupNumber" label="Group number" required span={4}>
            {(field) => <Input {...field} placeholder="Enter group number, or NONE" autoComplete="off" />}
          </FormField>
          <FormField
            name="claimNumber"
            label="Claim number"
            span={4}
            required={needsClaimNumber}
            info="Box 11b for PIP and Workers’ Comp."
          >
            {(field) => <Input {...field} placeholder="Enter WC / auto claim number" autoComplete="off" />}
          </FormField>

          <FormSection title="Subscriber">
            <FormField name="subscriberRelationship" label="Patient’s relationship to subscriber" span={4}>
              {(field) => (
                <Select
                  value={typeof field.value === 'string' ? field.value : null}
                  onChange={(next) => {
                    if (next !== null) field.onChange(next)
                  }}
                  options={SUBSCRIBER_RELATIONSHIPS.map((value) => ({ value, label: value }))}
                />
              )}
            </FormField>
            {relationship !== 'Self' && (
              <>
                <FormField name="subscriberName" label="Subscriber name" required span={4}>
                  {(field) => <Input {...field} placeholder="Enter full name" autoComplete="off" />}
                </FormField>
                <FormField name="subscriberDob" label="Subscriber DOB" required span={4}>
                  {(field) => (
                    <DateInput
                      value={typeof field.value === 'string' ? field.value : ''}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      max={todayIso()}
                    />
                  )}
                </FormField>
              </>
            )}
          </FormSection>

          {type === WORKERS_COMP && (
            <FormSection title="Employer (Workers’ Comp only)">
              <FormField name="employerName" label="Employer name" required span={6}>
                {(field) => <Input {...field} placeholder="Enter employer name" autoComplete="off" />}
              </FormField>
              <FormField name="employerAddress" label="Employer address" span={6}>
                {(field) => (
                  <Input {...field} placeholder="Enter employer address (optional)" autoComplete="off" />
                )}
              </FormField>
            </FormSection>
          )}
        </FormGrid>
      </Form>
    </Dialog>
  )
}
