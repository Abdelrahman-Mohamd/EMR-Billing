import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { Dialog } from './Dialog'
import { Field } from './Field'
import { Select, type SelectOption } from './Select'

const OPTIONS: SelectOption[] = [
  { value: 'off', label: 'Off — submit manually' },
  { value: 'hourly', label: 'Every hour' },
  { value: 'daily', label: 'Every day at 18:00', description: 'Last run yesterday' },
  { value: 'weekly', label: 'Weekdays only', disabled: true },
]

function Harness({ initial = null }: { initial?: string | null }) {
  const [value, setValue] = useState<string | null>(initial)
  return (
    <Field label="Schedule">
      <Select options={OPTIONS} value={value} onChange={setValue} />
    </Field>
  )
}

describe('Select', () => {
  it('is named by its field label even though it is not a native select', () => {
    renderWithProviders(<Harness />)
    expect(screen.getByRole('combobox', { name: 'Schedule' })).toBeInTheDocument()
  })

  it('opens and reports what was chosen', async () => {
    const onChange = vi.fn()
    renderWithProviders(
      <Field label="Schedule">
        <Select options={OPTIONS} value={null} onChange={onChange} />
      </Field>,
    )
    await userEvent.click(screen.getByRole('combobox', { name: 'Schedule' }))
    await userEvent.click(screen.getByRole('option', { name: /Every hour/ }))
    expect(onChange).toHaveBeenCalledWith('hourly')
  })

  it('opens from the keyboard and picks with Enter, like a native select', async () => {
    renderWithProviders(<Harness />)
    await userEvent.tab()
    await userEvent.keyboard('{ArrowDown}') // opens
    await userEvent.keyboard('{ArrowDown}{Enter}') // second option
    expect(screen.getByRole('combobox', { name: 'Schedule' })).toHaveTextContent('Every hour')
  })

  it('jumps to an option when you type its first letters', async () => {
    renderWithProviders(<Harness />)
    await userEvent.click(screen.getByRole('combobox', { name: 'Schedule' }))
    await userEvent.keyboard('every d')
    await userEvent.keyboard('{Enter}')
    expect(screen.getByRole('combobox', { name: 'Schedule' })).toHaveTextContent('Every day at 18:00')
  })

  it('opens on the current selection rather than at the top', async () => {
    renderWithProviders(<Harness initial="daily" />)
    await userEvent.click(screen.getByRole('combobox', { name: 'Schedule' }))
    await userEvent.keyboard('{Enter}')
    expect(screen.getByRole('combobox', { name: 'Schedule' })).toHaveTextContent('Every day at 18:00')
  })

  it('refuses a disabled option', async () => {
    const onChange = vi.fn()
    renderWithProviders(
      <Field label="Schedule">
        <Select options={OPTIONS} value={null} onChange={onChange} />
      </Field>,
    )
    await userEvent.click(screen.getByRole('combobox', { name: 'Schedule' }))
    await userEvent.click(screen.getByRole('option', { name: /Weekdays only/ }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('keeps its list scrollable inside a dialog: wheel and touch moves never reach the dialog’s scroll lock', async () => {
    renderWithProviders(
      <Dialog open onOpenChange={() => undefined} title="Edit">
        <Harness />
      </Dialog>,
    )
    await userEvent.click(screen.getByRole('combobox', { name: 'Schedule' }))
    // The lock listens on the document; the list's own moves must stop before it.
    const reachedDocument = vi.fn()
    document.addEventListener('wheel', reachedDocument)
    document.addEventListener('touchmove', reachedDocument)
    try {
      fireEvent.wheel(screen.getByRole('listbox'), { deltaY: 120 })
      fireEvent.touchMove(screen.getByRole('listbox'))
      expect(reachedDocument).not.toHaveBeenCalled()
    } finally {
      document.removeEventListener('wheel', reachedDocument)
      document.removeEventListener('touchmove', reachedDocument)
    }
  })
})
