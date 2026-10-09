import { useId, useState, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Plus, Stethoscope } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { isApiError, userMessage } from '@/lib/api/api-error'
import { Button, buttonClass } from '@/components/ui/Button'
import { DateInput } from '@/components/ui/DateInput'
import { Dialog } from '@/components/ui/Dialog'
import { FormGrid, FormSection } from '@/components/ui/Field'
import { Form, FormField, applyServerErrors } from '@/components/ui/Form'
import { Input } from '@/components/ui/Input'
import { Notice } from '@/components/ui/Notice'
import { SearchSelect } from '@/components/ui/SearchSelect'
import { Select } from '@/components/ui/Select'
import { Switch } from '@/components/ui/Switch'
import type { ReferringPhysician } from '@/features/admin-referring-physicians'
import { todayIso } from '@/lib/utils/dates'
import { isValidNpi } from '@/lib/validation/npi'
import { AUTO, INJURY_TYPES, type PatientCase } from '../../model/case'
import {
  CASE_NAME_MAX,
  caseFormSchema,
  newCaseValues,
  toCaseFormValues,
  type CaseFormValues,
} from '../../schemas/case-form'

/** What the case's primary insurance requires of it, when it has one. */
export interface PrimaryNeeds {
  injuryDateRequired: boolean
  /** Its name, for the injury-date help ("{name} requires it"). */
  insuranceName: string
}

/**
 * New or edit a case, in the prototype's layout: case name and referring
 * physician; Injury & dates — related cause, injury / onset date, accident
 * state, start of care, discharge date; and whether the case is open. The
 * case's insurances are added on its own Insurance card, not here; the
 * prototype's employment status is not in the case contract.
 *
 * Saving waits for the server; its field errors land on the fields, its other
 * refusals show above them, and the dialog stays.
 *
 * As in the prototype, the injury date and accident state wait for a related
 * cause (the injury date stays open when the primary insurance requires it),
 * and closing them clears them. When the practice has no referring physicians,
 * the form says where to add them.
 */
export function CaseDialog({
  item,
  referrers,
  primary,
  onSave,
  onClose,
}: {
  /** `null` adds a case. */
  item: PatientCase | null
  /** The practice's referring physicians. */
  referrers: readonly ReferringPhysician[]
  /** The case's primary insurance, when it has one (a new case has none yet). */
  primary: PrimaryNeeds | undefined
  /** Resolves with the server's message. */
  onSave: (values: CaseFormValues, injuryDateRequired: boolean) => Promise<unknown>
  onClose: () => void
}) {
  const formId = useId()
  const today = todayIso()
  const [failure, setFailure] = useState<string | null>(null)
  const form = useForm<CaseFormValues>({
    resolver: zodResolver(caseFormSchema(today)),
    defaultValues: item === null ? newCaseValues(today) : toCaseFormValues(item),
  })
  const submitting = form.formState.isSubmitting
  const injuryType = useWatch({ control: form.control, name: 'injuryType' })
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
          ? 'A case is one episode of care. Its insurances and diagnoses are added to it next.'
          : 'Visits inherit these values.'
      }
      size="lg"
      dismissible={!submitting}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={submitting}>
            {item === null ? 'Create case' : 'Save case'}
          </Button>
        </>
      }
    >
      <Form
        id={formId}
        form={form}
        onSubmit={async (values) => {
          setFailure(null)
          try {
            await onSave(values, primary?.injuryDateRequired ?? false)
            onClose()
          } catch (error) {
            const leftover = applyServerErrors(form, error)
            setFailure(isApiError(error) && error.kind !== 'validation' ? userMessage(error) : leftover)
          }
        }}
      >
        <FormGrid>
          {failure !== null && (
            <div className="col-span-12">
              <Notice tone="critical">{failure}</Notice>
            </div>
          )}
          <FormField
            name="name"
            label="Case name"
            required
            // The whole row when there is no physician to choose beside it.
            span={referrers.length === 0 ? 12 : 6}
            info="No two cases of a patient can share a name."
          >
            {(field) => (
              <Input
                {...field}
                placeholder="Enter case name, e.g. R shoulder 2026"
                maxLength={CASE_NAME_MAX}
                autoComplete="off"
                readOnly={submitting}
              />
            )}
          </FormField>
          {/* With nothing to choose from, the choice gives way to what to do first. */}
          {referrers.length === 0 ? (
            <EmptyChoice
              icon={<Stethoscope size={18} />}
              title="No referring physicians yet"
              action={
                <Link
                  to="/setup/referring-physicians"
                  className={buttonClass('default', 'sm', 'max-sm:ml-13')}
                >
                  <Plus size={14} aria-hidden="true" />
                  Add a referring physician
                </Link>
              }
            >
              Add one to the practice first. Their name and NPI go on the claim (Box 17).
            </EmptyChoice>
          ) : (
            <FormField
              name="referrerId"
              label="Referring physician"
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
          )}

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
                  options={INJURY_TYPES}
                  placeholder="Not related to an injury"
                  clearable
                />
              )}
            </FormField>
            <FormField
              name="injuryDate"
              label="Injury / onset date"
              span={4}
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
              required={injuryType === AUTO}
              disabled={!cause}
              info="Box 10b when auto related."
            >
              {(field) => (
                <Input
                  {...field}
                  onChange={(event) => field.onChange(event.target.value.toUpperCase())}
                  placeholder="Enter state"
                  maxLength={2}
                  disabled={!cause}
                />
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

/**
 * What stands in for a choice that has nothing to choose from yet: an icon,
 * what is missing, what to do, and the way to do it. The action wraps under
 * the text on a phone, lined up with it (`max-sm:ml-13` on the action).
 */
function EmptyChoice({
  icon,
  title,
  action,
  children,
}: {
  icon: ReactNode
  title: string
  action: ReactNode
  children: ReactNode
}) {
  return (
    <div className="bg-n50 rounded-card col-span-12 flex flex-wrap items-start gap-x-4 gap-y-3 px-4 py-3.5 sm:items-center">
      <span
        aria-hidden="true"
        className="bg-canvas text-n500 grid size-9 flex-none place-items-center rounded-full"
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 basis-56">
        <span className="text-meta text-ink block font-medium">{title}</span>
        <span className="text-micro text-n500 mt-0.5 block">{children}</span>
      </span>
      {action}
    </div>
  )
}
