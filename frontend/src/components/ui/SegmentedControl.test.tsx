import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { SegmentedControl } from './SegmentedControl'

const OPTIONS = [
  { value: 'edit', label: 'Edit' },
  { value: 'view', label: 'View' },
  { value: 'hidden', label: 'Hidden' },
] as const
type Level = (typeof OPTIONS)[number]['value']

function Harness({ disabled = false }: { disabled?: boolean }) {
  const [value, setValue] = useState<Level>('view')
  return (
    <SegmentedControl
      name="access-billing"
      label="Access to Billing"
      value={value}
      options={OPTIONS}
      onChange={setValue}
      disabled={disabled}
    />
  )
}

describe('SegmentedControl', () => {
  it('is a named radio group with one option checked', () => {
    renderWithProviders(<Harness />)
    expect(screen.getByRole('radiogroup', { name: 'Access to Billing' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'View' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Edit' })).not.toBeChecked()
  })

  it('changes on click and with the arrow keys', async () => {
    renderWithProviders(<Harness />)
    await userEvent.click(screen.getByText('Hidden'))
    expect(screen.getByRole('radio', { name: 'Hidden' })).toBeChecked()
    await userEvent.keyboard('{ArrowLeft}')
    expect(screen.getByRole('radio', { name: 'View' })).toBeChecked()
  })

  it('cannot be changed when disabled', async () => {
    renderWithProviders(<Harness disabled />)
    await userEvent.click(screen.getByText('Edit'))
    expect(screen.getByRole('radio', { name: 'View' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Edit' })).toBeDisabled()
  })
})
