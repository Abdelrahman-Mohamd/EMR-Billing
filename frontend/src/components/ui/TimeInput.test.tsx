import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { clockText, formatTime, parseClock } from '@/lib/utils/time'
import { Field } from './Field'
import { TimeInput } from './TimeInput'

function Harness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <Field label="At">
        <TimeInput value={value} onChange={setValue} />
      </Field>
      <output aria-label="Value">{value}</output>
    </>
  )
}
const valueOf = () => screen.getByRole('status', { name: 'Value' }).textContent
const box = () => screen.getByRole('textbox', { name: 'At' })
const period = () => screen.getByRole('combobox', { name: 'AM or PM' })

describe('time on the clock', () => {
  it('reads a typed time with the AM / PM chosen beside it', () => {
    expect(parseClock('6:07', true)).toBe('18:07')
    expect(parseClock('6:07', false)).toBe('06:07')
    expect(parseClock('607', true)).toBe('18:07')
    expect(parseClock('6', false)).toBe('06:00')
    expect(parseClock('12:30', false)).toBe('00:30')
    expect(parseClock('12:30', true)).toBe('12:30')
  })

  it('takes the 24-hour clock as it is, whatever the period says', () => {
    expect(parseClock('18:07', false)).toBe('18:07')
    expect(parseClock('0:30', true)).toBe('00:30')
  })

  it('refuses what is not a time', () => {
    expect(parseClock('6:75', false)).toBeNull()
    expect(parseClock('25:00', false)).toBeNull()
    expect(parseClock('soon', false)).toBeNull()
    expect(parseClock('', false)).toBeNull()
  })

  it('shows a time as people read it', () => {
    expect(formatTime('18:07')).toBe('6:07 PM')
    expect(clockText('18:07')).toBe('6:07')
    expect(clockText('')).toBe('')
  })
})

describe('TimeInput', () => {
  it('is a box for the time, named by its field, and an AM / PM dropdown beside it', () => {
    renderWithProviders(<Harness initial="18:07" />)
    expect(box()).toHaveValue('6:07')
    expect(period()).toHaveTextContent('PM')
  })

  it('takes any minute typed, with the period chosen', async () => {
    renderWithProviders(<Harness />)
    expect(box()).toHaveValue('')
    await userEvent.click(period())
    await userEvent.click(await screen.findByRole('option', { name: 'PM' }))
    await userEvent.type(box(), '6:07')
    expect(valueOf()).toBe('18:07')
    // AM / PM changes the time typed.
    await userEvent.click(period())
    await userEvent.click(await screen.findByRole('option', { name: 'AM' }))
    expect(valueOf()).toBe('06:07')
  })

  it('tidies a time on leaving, and lets a 24-hour time set AM / PM itself', async () => {
    renderWithProviders(<Harness />)
    await userEvent.type(box(), '1807')
    expect(valueOf()).toBe('18:07')
    expect(period()).toHaveTextContent('PM')
    await userEvent.tab()
    expect(box()).toHaveValue('6:07')
  })

  it('has no time while what is typed is not one — and keeps it there to be fixed', async () => {
    renderWithProviders(<Harness initial="09:00" />)
    await userEvent.clear(box())
    await userEvent.type(box(), '6:7')
    expect(valueOf()).toBe('')
    await userEvent.tab()
    expect(box()).toHaveValue('6:7')
  })
})
