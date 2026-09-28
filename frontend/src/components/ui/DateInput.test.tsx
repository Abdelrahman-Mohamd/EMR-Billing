import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { DateInput, parseIso, toIso } from './DateInput'
import { Field } from './Field'

// Billing is full of date boundaries; a test that only passes in September is
// not a test.
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date(2026, 8, 25)) // 25 September 2026, local time
})
afterEach(() => {
  vi.useRealTimers()
})

function Harness(props: { initial?: string; min?: string; max?: string }) {
  const [value, setValue] = useState(props.initial ?? '')
  return (
    <Field label="Injury date">
      <DateInput value={value} onChange={setValue} min={props.min} max={props.max} />
    </Field>
  )
}

describe('date parsing', () => {
  it('reads an ISO date as a local day, not a UTC instant', () => {
    // `new Date('2026-09-30')` is UTC midnight — the 29th west of Greenwich.
    expect(toIso(parseIso('2026-09-30')!)).toBe('2026-09-30')
  })

  it('refuses a date that does not exist', () => {
    expect(parseIso('2026-02-31')).toBeNull()
    expect(parseIso('not-a-date')).toBeNull()
  })
})

describe('DateInput', () => {
  it('shows the value the way the product writes dates', () => {
    renderWithProviders(<Harness initial="2026-09-30" />)
    expect(screen.getByRole('textbox', { name: 'Injury date' })).toHaveValue('09/30/2026')
  })

  it('accepts a typed date and reports it as ISO', async () => {
    const onChange = vi.fn()
    renderWithProviders(
      <Field label="Injury date">
        <DateInput value="" onChange={onChange} />
      </Field>,
    )
    await userEvent.type(screen.getByRole('textbox', { name: 'Injury date' }), '09/30/2026')
    expect(onChange).toHaveBeenLastCalledWith('2026-09-30')
  })

  it('opens a calendar and picks a day', async () => {
    renderWithProviders(<Harness initial="2026-09-10" />)
    await userEvent.click(screen.getByRole('button', { name: 'Choose a date from the calendar' }))

    const grid = screen.getByRole('grid', { name: 'September 2026' })
    await userEvent.click(within(grid).getByRole('button', { name: '17' }))

    expect(screen.getByRole('textbox', { name: 'Injury date' })).toHaveValue('09/17/2026')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('walks the calendar with the arrow keys and picks with Enter', async () => {
    renderWithProviders(<Harness initial="2026-09-10" />)
    await userEvent.click(screen.getByRole('button', { name: 'Choose a date from the calendar' }))

    // Focus starts on the selected day; one week down, one day right.
    await userEvent.keyboard('{ArrowDown}{ArrowRight}{Enter}')
    expect(screen.getByRole('textbox', { name: 'Injury date' })).toHaveValue('09/18/2026')
  })

  it('changes month with the arrows and with Page keys', async () => {
    renderWithProviders(<Harness initial="2026-09-10" />)
    await userEvent.click(screen.getByRole('button', { name: 'Choose a date from the calendar' }))

    await userEvent.click(screen.getByRole('button', { name: 'Next month' }))
    expect(screen.getByRole('grid', { name: 'October 2026' })).toBeInTheDocument()

    await userEvent.keyboard('{PageUp}')
    expect(screen.getByRole('grid', { name: 'September 2026' })).toBeInTheDocument()
  })

  it('jumps to another month from the caption instead of stepping there', async () => {
    renderWithProviders(<Harness initial="2026-09-10" />)
    await userEvent.click(screen.getByRole('button', { name: 'Choose a date from the calendar' }))

    await userEvent.click(screen.getByRole('button', { name: 'Choose a month or year' }))
    await userEvent.click(screen.getByRole('button', { name: 'Dec' }))

    const grid = screen.getByRole('grid', { name: 'December 2026' })
    await userEvent.click(within(grid).getByRole('button', { name: '24' }))
    expect(screen.getByRole('textbox', { name: 'Injury date' })).toHaveValue('12/24/2026')
  })

  it('reaches a distant year in three clicks: year, month, day', async () => {
    renderWithProviders(<Harness initial="2026-09-10" />)
    await userEvent.click(screen.getByRole('button', { name: 'Choose a date from the calendar' }))

    await userEvent.click(screen.getByRole('button', { name: 'Choose a month or year' }))
    await userEvent.click(screen.getByRole('button', { name: 'Choose a year' }))
    await userEvent.click(screen.getByRole('button', { name: '2019' }))
    await userEvent.click(screen.getByRole('button', { name: 'Feb' }))

    const grid = screen.getByRole('grid', { name: 'February 2019' })
    await userEvent.click(within(grid).getByRole('button', { name: '14' }))
    expect(screen.getByRole('textbox', { name: 'Injury date' })).toHaveValue('02/14/2019')
  })

  it('pages the year list twelve at a time', async () => {
    renderWithProviders(<Harness initial="2026-09-10" />)
    await userEvent.click(screen.getByRole('button', { name: 'Choose a date from the calendar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Choose a month or year' }))
    await userEvent.click(screen.getByRole('button', { name: 'Choose a year' }))

    expect(screen.getByRole('grid', { name: /Years 2016 to 2027/ })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Earlier years' }))
    expect(screen.getByRole('grid', { name: /Years 2004 to 2015/ })).toBeInTheDocument()
  })

  it('leaves the month chooser on Escape without closing the picker', async () => {
    renderWithProviders(<Harness initial="2026-09-10" />)
    await userEvent.click(screen.getByRole('button', { name: 'Choose a date from the calendar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Choose a month or year' }))

    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('grid', { name: 'September 2026' })).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('hides a month and a year that no day could satisfy', async () => {
    renderWithProviders(<Harness initial="2026-09-10" min="2026-06-01" max="2026-10-31" />)
    await userEvent.click(screen.getByRole('button', { name: 'Choose a date from the calendar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Choose a month or year' }))

    expect(screen.getByRole('button', { name: 'Jan' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Jul' })).toBeEnabled()
  })

  it('will not offer a day outside the allowed range', async () => {
    renderWithProviders(<Harness initial="2026-09-10" min="2026-09-05" max="2026-09-20" />)
    await userEvent.click(screen.getByRole('button', { name: 'Choose a date from the calendar' }))

    const grid = screen.getByRole('grid', { name: 'September 2026' })
    expect(within(grid).getByRole('button', { name: '25' })).toBeDisabled()
    expect(within(grid).getByRole('button', { name: '17' })).toBeEnabled()
  })

  it('offers today, and clearing what is set', async () => {
    renderWithProviders(<Harness initial="2026-09-10" />)
    await userEvent.click(screen.getByRole('button', { name: 'Choose a date from the calendar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Today' }))
    expect(screen.getByRole('textbox', { name: 'Injury date' })).toHaveValue('09/25/2026')

    await userEvent.click(screen.getByRole('button', { name: 'Choose a date from the calendar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.getByRole('textbox', { name: 'Injury date' })).toHaveValue('')
  })
})
