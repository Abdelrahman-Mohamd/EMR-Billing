import { useId, useRef, useState } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from '@/stores/toast-store'
import { Button } from '@/components/ui/Button'
import { DateInput } from '@/components/ui/DateInput'
import { Dialog } from '@/components/ui/Dialog'
import { FormGrid, FormSection } from '@/components/ui/Field'
import { Form, FormField, applyServerErrors } from '@/components/ui/Form'
import { Notice } from '@/components/ui/Notice'
import { SearchSelect } from '@/components/ui/SearchSelect'
import { Select } from '@/components/ui/Select'
import { listName } from '@/features/patients'
import { isApiError, userMessage } from '@/lib/api/api-error'
import { formatIsoDate, todayIso } from '@/lib/utils/dates'
import { useCreateVisit } from '../queries/use-visits'
import { useVisitReferences } from '../queries/use-visit-references'
import {
  newChargeLineValues,
  newVisitValues,
  toCreateVisitPayload,
  visitFormSchema,
  type VisitFormValues,
} from '../schemas/visit-form'
import { ChargeLineFields, type DiagnosisOption } from './ChargeLineFields'

/**
 * New visit, in a dialog: the visit and its first charge lines, in one go, as the visit
 * payload carries them — the case, date of service, location, billing and
 * treating providers, an optional authorization, then one or more lines
 * (procedure code, units, modifiers, diagnosis pointers).
 *
 * The case decides the rest: its practice's active locations and providers,
 * its authorizations and its diagnoses are what the pickers offer. Changing the
 * case clears what no longer belongs to it. More lines can be added to the
 * visit later, from the visit. Opened from the Visits list, or from a case on
 * the patient chart (`caseId`: the case already chosen). Creating it opens the
 * new visit.
 */
export function NewVisitDialog({ caseId, onClose }: { caseId?: string; onClose: () => void }) {
  const formId = useId()
  const navigate = useNavigate()
  const refs = useVisitReferences()
  const create = useCreateVisit()
  const today = todayIso()
  const [failure, setFailure] = useState<string | null>(null)
  const addRow = useRef<HTMLDivElement>(null)
  const lineRefs = useRef(new Map<string, HTMLFieldSetElement>())

  const form = useForm<VisitFormValues>({
    resolver: zodResolver(visitFormSchema(today)),
    defaultValues: newVisitValues(caseId ?? null, today),
  })
  const lines = useFieldArray({ control: form.control, name: 'lines' })
  const chosenCaseId = useWatch({ control: form.control, name: 'caseId' })

  const { records } = refs
  const chosenCase = records.cases.find((item) => item.id === chosenCaseId)
  const patient = records.patients.find((item) => item.id === chosenCase?.patientId)
  const practiceId = patient?.practiceId
  const locations = (refs.practices.find((practice) => practice.id === practiceId)?.locations ?? []).filter(
    (location) => location.isActive,
  )
  const providers = refs.providers.filter(
    (provider) => provider.practiceId === practiceId && provider.isActive,
  )
  const authorizations = records.authorizations.filter((auth) => auth.caseId === chosenCase?.id)
  const diagnoses: DiagnosisOption[] | null =
    chosenCase === undefined
      ? null
      : chosenCase.diagnoses.map((diagnosis, index) => ({ pointer: index + 1, ...diagnosis }))

  // Active patients' open cases, by patient: "Okonkwo, Nadia · R shoulder 2026".
  const caseOptions = records.cases
    .filter((item) => item.isActive)
    .flatMap((item) => {
      const owner = records.patients.find((entry) => entry.id === item.patientId && entry.isActive)
      return owner === undefined ? [] : [{ value: item.id, label: `${listName(owner)} · ${item.name}` }]
    })
    .sort((a, b) => a.label.localeCompare(b.label))

  const chooseCase = (next: string | null) => {
    form.setValue('caseId', next, { shouldValidate: form.formState.isSubmitted })
    // What belonged to the previous case's practice or case no longer applies.
    form.setValue('locationId', null)
    form.setValue('billingProviderId', null)
    form.setValue('treatingProviderId', null)
    form.setValue('authorizationId', null)
    lines.fields.forEach((_, index) => form.setValue(`lines.${index}.diagnosisPointers`, []))
  }

  const pick = (
    name: 'locationId' | 'billingProviderId' | 'treatingProviderId',
    label: string,
    options: Array<{ value: string; label: string }>,
    placeholder: string,
  ) => (
    <FormField name={name} label={label} required span={6}>
      {(field) => (
        <Select
          value={typeof field.value === 'string' ? field.value : null}
          onChange={field.onChange}
          options={options}
          placeholder={chosenCase === undefined ? 'Select a case first' : placeholder}
          disabled={chosenCase === undefined}
        />
      )}
    </FormField>
  )

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title="New visit"
      description="Record a visit on a case with its charge lines."
      size="lg"
      dismissible={!create.isPending}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={create.isPending}>
            Create visit
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
            const visit = await create.mutateAsync(toCreateVisitPayload(values))
            toast.success('Visit created')
            onClose()
            void navigate({ to: '/visits/$visitId', params: { visitId: String(visit.id) } })
          } catch (error) {
            const leftover = applyServerErrors(form, error)
            setFailure(isApiError(error) && error.kind !== 'validation' ? userMessage(error) : leftover)
          }
        }}
      >
        <FormGrid>
          <FormSection title="Visit" />
          <FormField name="caseId" label="Case" required span={12}>
            {(field) => (
              <SearchSelect
                value={typeof field.value === 'string' ? field.value : null}
                onChange={chooseCase}
                options={caseOptions}
                placeholder="Select a patient’s case"
                searchPlaceholder="Search patients or cases"
              />
            )}
          </FormField>
          <FormField name="dateOfService" label="Date of service" required span={6}>
            {(field) => (
              <DateInput
                value={typeof field.value === 'string' ? field.value : ''}
                onChange={field.onChange}
                onBlur={field.onBlur}
                max={today}
              />
            )}
          </FormField>
          {pick(
            'locationId',
            'Location',
            locations.map((location) => ({ value: String(location.id), label: location.name })),
            'Select a location',
          )}
          {pick(
            'billingProviderId',
            'Billing provider',
            providers.map((provider) => ({
              value: String(provider.id),
              label: refs.providerName(provider.id),
            })),
            'Select the billing provider',
          )}
          {pick(
            'treatingProviderId',
            'Treating provider',
            providers.map((provider) => ({
              value: String(provider.id),
              label: refs.providerName(provider.id),
            })),
            'Select the treating provider',
          )}
          <FormField name="authorizationId" label="Authorization" span={6}>
            {(field) => (
              <Select
                value={typeof field.value === 'string' ? field.value : null}
                onChange={field.onChange}
                options={authorizations.map((auth) => ({
                  value: auth.id,
                  label: `${auth.number} · ${formatIsoDate(auth.start)} – ${formatIsoDate(auth.end)}`,
                }))}
                placeholder={chosenCase === undefined ? 'Select a case first' : 'None'}
                disabled={chosenCase === undefined}
                clearable
              />
            )}
          </FormField>

          <FormSection title="Charge lines" />
          {lines.fields.map((line, index) => (
            <fieldset
              key={line.id}
              ref={(element) => {
                if (element === null) lineRefs.current.delete(line.id)
                else lineRefs.current.set(line.id, element)
              }}
              className="border-rule-structural rounded-card col-span-12 min-w-0 border px-4 pt-3 pb-4"
            >
              {/* The legend comes first, so it names the group: "Charge line 2". */}
              <legend className="text-meta text-ink float-left py-1 font-medium">
                Charge line {index + 1}
              </legend>
              {lines.fields.length > 1 && (
                <Button
                  size="sm"
                  variant="quiet"
                  className="float-right"
                  icon={<Trash2 size={14} aria-hidden="true" />}
                  aria-label={`Remove charge line ${index + 1}`}
                  onClick={() => {
                    lines.remove(index)
                    // The removed line's place is gone: continue from the add button.
                    requestAnimationFrame(() => addRow.current?.querySelector('button')?.focus())
                  }}
                >
                  Remove
                </Button>
              )}
              <FormGrid className="clear-both mt-2">
                <ChargeLineFields prefix={`lines.${index}.`} codes={refs.codes} diagnoses={diagnoses} />
              </FormGrid>
            </fieldset>
          ))}
          <div ref={addRow} className="col-span-12">
            <Button
              size="sm"
              icon={<Plus size={14} aria-hidden="true" />}
              onClick={() => {
                lines.append(newChargeLineValues(), { shouldFocus: false })
                // Move to the new line, so a keyboard user carries on there.
                requestAnimationFrame(() => {
                  const added = [...lineRefs.current.values()].at(-1)
                  added?.querySelector<HTMLElement>('button, input')?.focus()
                })
              }}
            >
              Add charge line
            </Button>
          </div>
        </FormGrid>

        {failure !== null && (
          <Notice tone="critical" className="mt-5">
            {failure}
          </Notice>
        )}
      </Form>
    </Dialog>
  )
}
