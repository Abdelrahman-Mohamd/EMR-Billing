import { z } from 'zod'
import { SCHEDULE_KINDS, type ScheduleKind } from '../model/schedule'
import type { NewScheduleOption } from '../data/automation-store'

const KINDS = SCHEDULE_KINDS.map((kind) => kind.value) as [ScheduleKind, ...ScheduleKind[]]

/**
 * What "Add an option" accepts — the prototype's checks, as messages on the
 * field they are about:
 * - **Every few hours:** how many hours apart is required ("Say how many hours
 *   apart."), a whole number from 1 to 12 (the prototype's input range).
 * - **Every day / Weekdays at a time:** the time is required ("Choose a time of
 *   day.").
 * Only the field the chosen kind shows is checked. An option already on the
 * list is refused by the list itself (`addOption`), as in the prototype.
 */
export const scheduleOptionFormSchema = z
  .object({
    kind: z.enum(KINDS),
    hours: z.string().trim(),
    time: z.string().trim(),
  })
  .superRefine((values, ctx) => {
    if (values.kind === 'hours') {
      if (values.hours === '')
        ctx.addIssue({ code: 'custom', path: ['hours'], message: 'Say how many hours apart.' })
      else if (!/^\d+$/.test(values.hours) || Number(values.hours) < 1 || Number(values.hours) > 12)
        ctx.addIssue({ code: 'custom', path: ['hours'], message: 'Please enter a valid number.' })
    } else if (values.time === '') {
      ctx.addIssue({ code: 'custom', path: ['time'], message: 'Choose a time of day.' })
    }
  })

export type ScheduleOptionFormValues = z.infer<typeof scheduleOptionFormSchema>

/** The prototype's starting values: every day at 18:00 (4 hours if switched to hours). */
export const NEW_SCHEDULE_OPTION: ScheduleOptionFormValues = { kind: 'daily', hours: '4', time: '18:00' }

export function toNewScheduleOption(values: ScheduleOptionFormValues): NewScheduleOption {
  return values.kind === 'hours'
    ? { kind: 'hours', hours: Number(values.hours), time: null }
    : { kind: values.kind, hours: null, time: values.time }
}
