/**
 * Scheduled submission as the prototype shows it (PRD V2 §5.1; options from
 * the client meeting of 2026-09-23). **Frontend only:** no backend exists for
 * submission & automation, so these are the screen's own shapes, not a
 * contract.
 *
 * - One setting: submit released charges automatically — **Off** (submit by
 *   hand) or one **option** from a list the practice fills itself.
 * - An option is "every few hours", "every day at a time" or "weekdays at a
 *   time". Nothing more is defined: no time zone, retry, window or holiday —
 *   when and how a run happens is the server's (open question Q-041).
 */
export const SCHEDULE_KINDS = [
  { value: 'hours', label: 'Every few hours' },
  { value: 'daily', label: 'Every day at a time' },
  { value: 'weekdays', label: 'Weekdays at a time' },
] as const

export type ScheduleKind = (typeof SCHEDULE_KINDS)[number]['value']

export interface ScheduleOption {
  id: string
  kind: ScheduleKind
  /** For "every few hours": how many hours apart (1–12). */
  hours: number | null
  /** For a time of day: "18:00". */
  time: string | null
  /** As the dropdown shows it: "Every 4 hours", "Weekdays at 07:30". */
  label: string
}

/** The setting's value for "Off — submit manually". */
export const SUBMIT_MANUALLY = 'off'

export interface AutomationSettings {
  /** `SUBMIT_MANUALLY`, or the id of the option in use. */
  schedule: string
  options: readonly ScheduleOption[]
  /** When the scheduled job last ran — a timestamp, or null if never. */
  lastScheduledRun: string | null
}

/** The prototype's names for an option. */
export function scheduleLabel(option: Pick<ScheduleOption, 'kind' | 'hours' | 'time'>): string {
  if (option.kind === 'hours') return `Every ${option.hours === 1 ? 'hour' : `${option.hours ?? ''} hours`}`
  return `${option.kind === 'daily' ? 'Every day' : 'Weekdays'} at ${option.time ?? ''}`
}
