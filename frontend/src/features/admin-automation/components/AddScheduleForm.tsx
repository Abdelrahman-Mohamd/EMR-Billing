import { useId } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus } from 'lucide-react'
import { toast } from '@/stores/toast-store'
import { Button } from '@/components/ui/Button'
import { Form, FormField } from '@/components/ui/Form'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { TimeInput } from '@/components/ui/TimeInput'
import type { AutomationSource } from '../data/automation-store'
import { SCHEDULE_KINDS, type ScheduleKind } from '../model/schedule'
import {
  NEW_SCHEDULE_OPTION,
  scheduleOptionFormSchema,
  toNewScheduleOption,
  type ScheduleOptionFormValues,
} from '../schemas/schedule-option-form'

/**
 * "Add a schedule", in one row under the choices it adds to: How often, then
 * Every (hours) or At — only the field the kind needs, as in the prototype —
 * and the button. A schedule added here can be chosen at once; it is not used
 * until the setting is saved with it. The same schedule twice is refused.
 */
export function AddScheduleForm({ automation }: { automation: AutomationSource }) {
  const formId = useId()
  const form = useForm<ScheduleOptionFormValues>({
    resolver: zodResolver(scheduleOptionFormSchema),
    defaultValues: NEW_SCHEDULE_OPTION,
  })
  const kind = useWatch({ control: form.control, name: 'kind' })

  const onSubmit = (values: ScheduleOptionFormValues) => {
    const result = automation.addOption(toNewScheduleOption(values))
    if (!result.added) {
      toast.warning('Already on the list', `“${result.label}” is already a schedule.`)
      return
    }
    toast.success('Schedule added', `“${result.label}” can now be chosen.`)
    form.reset(NEW_SCHEDULE_OPTION)
  }

  return (
    <Form id={formId} form={form} onSubmit={onSubmit}>
      {/* One row — How often takes the room left, the button on the fields' line — stacked on a phone. */}
      <div className="flex flex-wrap items-start gap-x-3 gap-y-4 pt-4">
        <div className="min-w-[200px] flex-1">
          <FormField name="kind" label="How often">
            {(field) => (
              <Select
                value={typeof field.value === 'string' ? field.value : null}
                onChange={(next) => {
                  const chosen = SCHEDULE_KINDS.find((option) => option.value === next)?.value
                  if (chosen !== undefined) field.onChange(chosen satisfies ScheduleKind)
                }}
                options={SCHEDULE_KINDS}
              />
            )}
          </FormField>
        </div>
        {/* Only the field this kind needs is shown, as in the prototype. */}
        {kind === 'hours' ? (
          <div className="w-full sm:w-[176px]">
            <FormField name="hours" label="Every (hours)" info="From 1 to 12.">
              {(field) => (
                <Input
                  {...field}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={12}
                  step={1}
                  placeholder="Enter hours"
                />
              )}
            </FormField>
          </div>
        ) : (
          <div className="w-full sm:w-[200px]">
            <FormField name="time" label="At">
              {(field) => (
                <TimeInput
                  value={typeof field.value === 'string' ? field.value : ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            </FormField>
          </div>
        )}
        {/* Lined up with the inputs, under their labels' height. */}
        <div className="w-full sm:w-auto sm:pt-[26px]">
          <Button type="submit" icon={<Plus size={16} aria-hidden="true" />} className="w-full sm:w-auto">
            Add schedule
          </Button>
        </div>
      </div>
    </Form>
  )
}
