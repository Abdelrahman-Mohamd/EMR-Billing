const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const pad = (value: number) => String(value).padStart(2, '0')
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

/**
 * The prototype's timestamp cells (the audit log's "When", the EMR payload
 * log's "Received"): a short label — "Today 14:32", "Yesterday 14:32",
 * "Sep 12 14:32" — over the full date, 09/12/2026.
 *
 * The timestamp's format is not defined by any contract. It is read as ISO
 * 8601 and shown in the viewer's own time zone, as the browser reports it: a
 * value with an offset or `Z` is converted, one without is taken as local
 * time. Nothing else is assumed. A value that cannot be read is shown as it
 * came, never replaced by a guess.
 */
export function formatWhen(timestamp: string, now: Date = new Date()): { label: string; date: string } {
  const at = new Date(timestamp)
  if (Number.isNaN(at.getTime())) return { label: timestamp, date: '' }
  const time = `${pad(at.getHours())}:${pad(at.getMinutes())}`
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  const day = sameDay(at, now)
    ? 'Today'
    : sameDay(at, yesterday)
      ? 'Yesterday'
      : `${MONTHS[at.getMonth()] ?? ''} ${at.getDate()}`
  return {
    label: `${day} ${time}`,
    date: `${pad(at.getMonth() + 1)}/${pad(at.getDate())}/${at.getFullYear()}`,
  }
}
