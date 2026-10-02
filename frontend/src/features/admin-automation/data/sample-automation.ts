import type { AutomationSettings } from '../model/schedule'

/**
 * TEMPORARY DEVELOPMENT DATA — not settings from any system.
 *
 * The prototype's settings, so the screen can be seen with content in
 * development and tests: its three options, "Every day at 18:00" in use, and a
 * last run yesterday at 18:00. Loaded only when `__MOCK_DATA__` is true (see
 * `automation-store.ts`), so a production build never contains them.
 */
const yesterdayAt = (time: string) => {
  const day = new Date()
  day.setDate(day.getDate() - 1)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}T${time}:00`
}

export const SAMPLE_AUTOMATION: AutomationSettings = {
  schedule: 'sample-daily-18',
  options: [
    { id: 'sample-hourly', kind: 'hours', hours: 1, time: null, label: 'Every hour' },
    { id: 'sample-4h', kind: 'hours', hours: 4, time: null, label: 'Every 4 hours' },
    { id: 'sample-daily-18', kind: 'daily', hours: null, time: '18:00', label: 'Every day at 18:00' },
  ],
  lastScheduledRun: yesterdayAt('18:00'),
}
