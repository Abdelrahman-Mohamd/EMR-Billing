import { describe, expect, it } from 'vitest'
import { scheduleLabel } from '../model/schedule'
import { scheduleOptionFormSchema, toNewScheduleOption } from './schedule-option-form'

const messages = (values: unknown) => {
  const result = scheduleOptionFormSchema.safeParse(values)
  return result.success ? [] : result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
}

describe('Add an option', () => {
  it('asks how many hours apart, from 1 to 12, only for "Every few hours"', () => {
    expect(messages({ kind: 'hours', hours: '', time: '' })).toEqual(['hours: Say how many hours apart.'])
    expect(messages({ kind: 'hours', hours: '13', time: '' })).toEqual([
      'hours: Please enter a valid number.',
    ])
    expect(messages({ kind: 'hours', hours: '2.5', time: '' })).toEqual([
      'hours: Please enter a valid number.',
    ])
    expect(messages({ kind: 'hours', hours: '6', time: '' })).toEqual([])
  })

  it('asks for a time of day for the other kinds', () => {
    expect(messages({ kind: 'daily', hours: '', time: '' })).toEqual(['time: Choose a time of day.'])
    expect(messages({ kind: 'weekdays', hours: 'x', time: '07:30' })).toEqual([])
  })

  it('keeps only what the kind uses, and names it as the prototype does', () => {
    const hourly = toNewScheduleOption(
      scheduleOptionFormSchema.parse({ kind: 'hours', hours: '1', time: '18:00' }),
    )
    expect(hourly).toEqual({ kind: 'hours', hours: 1, time: null })
    expect(scheduleLabel(hourly)).toBe('Every hour')
    expect(scheduleLabel({ kind: 'hours', hours: 4, time: null })).toBe('Every 4 hours')
    const weekdays = toNewScheduleOption(
      scheduleOptionFormSchema.parse({ kind: 'weekdays', hours: '4', time: '07:30' }),
    )
    expect(weekdays).toEqual({ kind: 'weekdays', hours: null, time: '07:30' })
    expect(scheduleLabel(weekdays)).toBe('Weekdays at 07:30')
    expect(scheduleLabel({ kind: 'daily', hours: null, time: '18:00' })).toBe('Every day at 18:00')
  })
})
