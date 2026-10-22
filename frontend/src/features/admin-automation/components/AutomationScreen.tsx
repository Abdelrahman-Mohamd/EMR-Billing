import { useId, useState } from 'react'
import { toast } from '@/stores/toast-store'
import { StatusDot, Tag } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { CardGroup, DetailCard } from '@/components/ui/DetailCard'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { KeyValue } from '@/components/ui/KeyValue'
import { RowActionButton } from '@/components/ui/RowActions'
import { Skeleton } from '@/components/ui/States'
import { PageContainer, PageHeader } from '@/components/shared/PageLayout'
import { cn } from '@/lib/utils/cn'
import { formatWhen } from '@/lib/utils/format-when'
import { useAutomation } from '../data/automation-store'
import { SUBMIT_MANUALLY, type ScheduleOption } from '../model/schedule'
import { AddScheduleForm } from './AddScheduleForm'

const OFF_LABEL = 'Off — submit manually'

/**
 * Admin → Submission & automation: when released charges are submitted
 * automatically. Two cards side by side from 1024px (stacked below):
 * - **Scheduled submission** — the choice itself, shown, not hidden in a
 *   dropdown: Off (submit manually) or one of the practice's schedules, a
 *   radio each; the one in use marked, every other one deletable (after
 *   asking). Under them, "Add a schedule" in one row (How often, then Every or
 *   At). "Save settings" at the card's foot, enabled once the choice changed.
 * - **In effect** — what is saved now and when the scheduled job last ran.
 *
 * The prototype's "Scheduled submission options" dialog is folded into the
 * card (user, 2026-10-22: the page was too empty, the dialog awkward). The
 * prototype's "Payer SLA" section is left out, at the user's request: each
 * insurance's SLA is set on the insurance.
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
  const groupName = useId()
  const [chosen, setChosen] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<ScheduleOption | null>(null)

  // The choice being edited: what was picked here, else what is saved. A
  // schedule deleted meanwhile falls back to what is saved.
  const offered = (value: string) =>
    value === SUBMIT_MANUALLY || settings.options.some((option) => option.id === value)
  const value = chosen !== null && offered(chosen) ? chosen : settings.schedule
  const changed = value !== settings.schedule

  const lastRun = settings.lastScheduledRun === null ? 'Never' : formatWhen(settings.lastScheduledRun).label
  // The saved schedule, if any — what is in effect now.
  const inEffect = settings.options.find((option) => option.id === settings.schedule)

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

  /** One choice: its radio and name, then "In use" or its Delete. */
  const choice = (id: string, label: string, option?: ScheduleOption) => {
    const inUse = settings.schedule === id
    return (
      <li
        key={id}
        className="border-rule-row flex min-h-12 items-center gap-3 border-b py-1.5 last:border-b-0"
      >
        <label className="text-meta text-ink flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 py-1.5">
          <input
            type="radio"
            name={groupName}
            value={id}
            checked={value === id}
            onChange={() => setChosen(id)}
          />
          <span className={cn('min-w-0 [overflow-wrap:anywhere]', value === id && 'font-medium')}>
            {label}
          </span>
        </label>
        {inUse ? (
          <Tag tone="brand">In use</Tag>
        ) : (
          option !== undefined && (
            <RowActionButton
              action="delete"
              label={`Delete schedule ${option.label}`}
              onClick={() => setDeleting(option)}
            />
          )
        )}
      </li>
    )
  }

  return (
    <PageContainer>
      <PageHeader
        title="Submission & automation"
        description="When released charges are submitted automatically."
      />

      {!automation.ready ? (
        <div className="grid gap-4" aria-busy="true">
          <Skeleton className="h-40" />
        </div>
      ) : (
        // The setting, then what is in effect beside it: a page that reads across, not one narrow card.
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <DetailCard
            title="Scheduled submission"
            info="Released charges are submitted on the chosen schedule. Off leaves them to be submitted by hand."
          >
            <div role="radiogroup" aria-label="Submit released charges automatically" className="pt-2">
              <ul>
                {choice(SUBMIT_MANUALLY, OFF_LABEL)}
                {settings.options.map((option) => choice(option.id, option.label, option))}
              </ul>
              {settings.options.length === 0 && (
                <p className="text-micro text-n500 pt-1">No schedules yet — add one below.</p>
              )}
            </div>

            <CardGroup title="Add a schedule" className="mt-6">
              <AddScheduleForm automation={automation} />
            </CardGroup>

            {/* The card's foot: saving what was chosen above. */}
            <div className="border-rule-structural mt-6 flex flex-wrap items-center justify-end gap-3 border-t pt-4">
              {changed && <span className="text-micro text-n500 mr-auto">The choice is not saved yet.</span>}
              <Button variant="primary" onClick={save} disabled={!changed}>
                Save settings
              </Button>
            </div>
          </DetailCard>

          {/* On a phone the summary comes first: what is in effect, then how to change it. */}
          <DetailCard title="In effect" className="order-first lg:order-none">
            <div className="pt-4">
              {inEffect === undefined ? (
                <StatusDot tone="inert">{OFF_LABEL}</StatusDot>
              ) : (
                <StatusDot tone="success">{inEffect.label}</StatusDot>
              )}
              <KeyValue
                layout="rows"
                className="mt-3"
                items={[
                  {
                    label: 'Released charges',
                    value: inEffect === undefined ? 'Submitted by hand' : 'Submitted on schedule',
                  },
                  { label: 'Last run', value: lastRun },
                ]}
              />
            </div>
          </DetailCard>
        </div>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title="Delete this schedule?"
        description={deleting === null ? '' : `“${deleting.label}” will no longer be offered.`}
        confirmLabel="Delete schedule"
        tone="destructive"
        onConfirm={() => {
          if (deleting !== null) automation.removeOption(deleting.id)
          setDeleting(null)
        }}
      />
    </PageContainer>
  )
}
