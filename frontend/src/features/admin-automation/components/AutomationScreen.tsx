import { useState } from 'react'
import { Clock } from 'lucide-react'
import { toast } from '@/stores/toast-store'
import { Button } from '@/components/ui/Button'
import { StatusDot } from '@/components/ui/Badge'
import { Section } from '@/components/ui/Card'
import { Field } from '@/components/ui/Field'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/States'
import { PageContainer, PageHeader } from '@/components/shared/PageLayout'
import { formatWhen } from '@/lib/utils/format-when'
import { useAutomation } from '../data/automation-store'
import { SUBMIT_MANUALLY } from '../model/schedule'
import { ScheduleOptionsDialog } from './ScheduleOptionsDialog'

/**
 * Admin → Submission & automation, as the prototype has it — a short settings
 * page, at a readable width, laid out so it reads at a glance: the setting in
 * effect beside the section title; "Manage the list" beside the dropdown it
 * fills; "Save settings" with the setting it saves, enabled once something
 * changed.
 * - **Scheduled submission:** "Submit released charges automatically" — Off
 *   (submit manually) or one of the options — with when the scheduled job
 *   last ran; and the list of options, which the practice fills itself
 *   ("Manage the list").
 * - **Save settings**, which keeps the chosen setting.
 *
 * The prototype's "Payer SLA" section (a pointer to Setup → Insurances) is left
 * out, at the user's request: each insurance's SLA is set on the insurance.
 *
 * **Frontend only.** There is no backend for these settings: they live in this
 * browser tab (`data/automation-store.ts`). Nothing here runs a schedule or
 * submits a claim — the scheduled job is the server's. That is architecture,
 * not product: the screen shows no message about it.
 *
 * Not built: the prototype lets only users whose role allows it change the
 * settings (others see them read-only); there is no permission model here yet
 * (docs/FRONTEND_ARCHITECTURE.md §8).
 */
export function AutomationScreen() {
  const automation = useAutomation()
  const { settings } = automation
  const [chosen, setChosen] = useState<string | null>(null)
  const [managing, setManaging] = useState(false)

  // The setting being edited: what was chosen here, else what is saved. An
  // option removed meanwhile falls back to what is saved.
  const offered = (value: string) =>
    value === SUBMIT_MANUALLY || settings.options.some((option) => option.id === value)
  const value = chosen !== null && offered(chosen) ? chosen : settings.schedule

  const lastRun = settings.lastScheduledRun === null ? 'never' : formatWhen(settings.lastScheduledRun).label
  // The saved option, if any — what is in effect now.
  const inEffect = settings.options.find((option) => option.id === settings.schedule)
  const changed = value !== settings.schedule

  const save = () => {
    automation.saveSchedule(value)
    setChosen(null)
    toast.success(
      'Settings saved',
      value === SUBMIT_MANUALLY
        ? 'Released charges are submitted manually.'
        : 'The next scheduled run uses this interval.',
    )
  }

  return (
    <PageContainer>
      <PageHeader
        title="Submission & automation"
        description="When released charges are submitted automatically."
      />

      {!automation.ready ? (
        <div className="grid max-w-[720px] gap-4" aria-busy="true">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-10" />
          <Skeleton className="h-6 w-40" />
        </div>
      ) : (
        <div className="max-w-[720px]">
          <Section
            title="Scheduled submission"
            className="pt-0"
            // What is in effect now, at a glance — the saved setting, not the one being edited.
            aside={
              inEffect === undefined ? (
                <StatusDot tone="inert">Off — submit manually</StatusDot>
              ) : (
                <StatusDot tone="success">{inEffect.label}</StatusDot>
              )
            }
          >
            {/* A stack, not a grid: Field spans 12 form-grid columns by default. */}
            <div className="mt-4 flex flex-col gap-4">
              <Field label="Submit released charges automatically" description={`Last run ${lastRun}.`}>
                {/* The list sits beside the dropdown it fills. */}
                <div className="flex flex-wrap gap-2">
                  <div className="min-w-0 flex-1 basis-60">
                    <Select
                      value={value}
                      onChange={(next) => {
                        if (next !== null) setChosen(next)
                      }}
                      options={[
                        { value: SUBMIT_MANUALLY, label: 'Off — submit manually' },
                        ...settings.options.map((option) => ({ value: option.id, label: option.label })),
                      ]}
                    />
                  </div>
                  <Button icon={<Clock size={16} aria-hidden="true" />} onClick={() => setManaging(true)}>
                    Manage the list
                  </Button>
                </div>
              </Field>
              <div>
                {/* Beside what it saves, and only when something changed. */}
                <Button variant="primary" onClick={save} disabled={!changed}>
                  Save settings
                </Button>
              </div>
            </div>
          </Section>
        </div>
      )}

      {managing && <ScheduleOptionsDialog automation={automation} onClose={() => setManaging(false)} />}
    </PageContainer>
  )
}
