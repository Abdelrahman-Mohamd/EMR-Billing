/**
 * Times of day. The value is always a 24-hour `HH:MM` string ("18:00") — the
 * shape a form and a store keep; people read and type the 12-hour clock
 * ("6:00 PM"), as US forms write it.
 */
export interface TimeParts {
  /** 1–12. */
  hour: number
  minute: number
  pm: boolean
}

const pad = (value: number) => String(value).padStart(2, '0')

export function toTimeParts(time: string): TimeParts | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time)
  if (!match) return null
  const hours = Number(match[1])
  const minute = Number(match[2])
  if (hours > 23 || minute > 59) return null
  return { hour: hours % 12 === 0 ? 12 : hours % 12, minute, pm: hours >= 12 }
}

/** "18:00" → "6:00 PM"; '' for anything that is not a time. */
export function formatTime(time: string): string {
  const parts = toTimeParts(time)
  return parts === null ? '' : `${parts.hour}:${pad(parts.minute)} ${parts.pm ? 'PM' : 'AM'}`
}

/**
 * A typed clock time, with the AM / PM chosen beside it, as "HH:MM": "6:07",
 * "607" or "6" (on the hour) on the 12-hour clock; "18:07" or "0:30" on the
 * 24-hour one, whose hour says the period itself. Null when it is not a time.
 */
export function parseClock(text: string, pm: boolean): string | null {
  const match = /^(\d{1,2})(?::?(\d{2}))?$/.exec(text.trim())
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2] ?? '0')
  if (hour > 23 || minute > 59) return null
  if (hour === 0 || hour > 12) return `${pad(hour)}:${pad(minute)}`
  return `${pad((hour % 12) + (pm ? 12 : 0))}:${pad(minute)}`
}

/** "18:07" → "6:07", the clock without its period; '' for anything that is not a time. */
export function clockText(time: string): string {
  const parts = toTimeParts(time)
  return parts === null ? '' : `${parts.hour}:${pad(parts.minute)}`
}
