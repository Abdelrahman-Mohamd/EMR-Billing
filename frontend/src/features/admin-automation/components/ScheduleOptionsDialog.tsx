import { useId, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Clock } from 'lucide-react'
import { toast } from '@/stores/toast-store'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog'
import { FormGrid, FormSection } from '@/components/ui/Field'
import { Form, FormField } from '@/components/ui/Form'
import { Input } from '@/components/ui/Input'
import { RowActionButton, actionsColumn } from '@/components/ui/RowActions'
import { Select } from '@/components/ui/Select'
import { EmptyState } from '@/components/ui/States'
import type { AutomationSource } from '../data/automation-store'
import { SCHEDULE_KINDS, type ScheduleKind, type ScheduleOption } from '../model/schedule'
import {
  NEW_SCHEDULE_OPTION,
  scheduleOptionFormSchema,
  toNewScheduleOption,
  type ScheduleOptionFormValues,
} from '../schemas/schedule-option-form'

/**
 * The prototype's "Scheduled submission options": the list the screen's
 * dropdown offers — each option, the one in use marked "In use", and Remove on
 * the others (after a confirmation) — and "Add an option": How often, then
 * either Every (hours) or At (a time), as the kind needs.
 *
 * An option added here is offered at once; it is not used until the screen's
 * setting is saved with it.
 */
export function ScheduleOptionsDialog({
  automation,
  onClose,
}: {
  automation: AutomationSource
  onClose: () => void
}) {
  const formId = useId()
  const [removing, setRemoving] = useState<ScheduleOption | null>(null)
  const { settings } = automation
  const form = useForm<ScheduleOptionFormValues>({
    resolver: zodResolver(scheduleOptionFormSchema),
    defaultValues: NEW_SCHEDULE_OPTION,
  })
  const kind = useWatch({ control: form.control, name: 'kind' })

  const onSubmit = (values: ScheduleOptionFormValues) => {
    const result = automation.addOption(toNewScheduleOption(values))
    if (!result.added) {
      toast.warning('Already on the list', `“${result.label}” is already an option.`)
      return
    }
    toast.success('Option added', `“${result.label}” is now in the dropdown.`)
    form.reset(NEW_SCHEDULE_OPTION)
  }

  const columns: ReadonlyArray<Column<ScheduleOption>> = [
    {
      key: 'label',
      header: 'Option',
      primary: true,
      cell: (option) => <span className="[overflow-wrap:anywhere]">{option.label}</span>,
    },
    {
      key: 'inUse',
      header: 'Used now',
      cell: (option) =>
        settings.schedule === option.id ? (
          <Badge tone="success">In use</Badge>
        ) : (
          <span className="text-n400">—</span>
        ),
    },
    // The option in use cannot be removed, so it has no action.
    actionsColumn<ScheduleOption>((option) =>
      settings.schedule === option.id ? null : (
        <RowActionButton
          action="delete"
          label={`Remove ${option.label}`}
          title="Remove"
          onClick={() => setRemoving(option)}
        />
      ),
    ),
  ]

  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) onClose()
        }}
        title="Scheduled submission options"
        description="What the dropdown on this screen offers. The option in use cannot be removed."
        size="md"
        footer={
          <>
            <Button variant="quiet" onClick={onClose}>
              Close
            </Button>
            <Button type="submit" form={formId} variant="primary">
              Add option
            </Button>
          </>
        }
      >
        <DataTable
          caption="Scheduled submission options"
          columns={columns}
          rows={settings.options}
          getRowId={(option) => option.id}
          empty={
            <EmptyState
              icon={<Clock size={20} />}
              title="No options yet"
              description="Without one, released charges are only submitted by hand."
            />
          }
        />

        <Form id={formId} form={form} onSubmit={onSubmit} className="mt-6">
          <FormGrid>
            <FormSection title="Add an option">
              <FormField name="kind" label="How often" span={6}>
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
              {/* Only the field this kind needs is shown, as in the prototype. */}
              {kind === 'hours' ? (
                <FormField name="hours" label="Every (hours)" span={6} description="From 1 to 12.">
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
              ) : (
                <FormField name="time" label="At" span={6}>
                  {(field) => <Input {...field} type="time" />}
                </FormField>
              )}
            </FormSection>
          </FormGrid>
        </Form>
      </Dialog>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null)
        }}
        title="Remove this option?"
        description={removing === null ? '' : `“${removing.label}” will no longer be offered.`}
        confirmLabel="Remove"
        tone="destructive"
        onConfirm={() => {
          if (removing !== null) automation.removeOption(removing.id)
          setRemoving(null)
        }}
      />
    </>
  )
}
