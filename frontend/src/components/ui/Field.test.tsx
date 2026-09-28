import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { Field } from './Field'
import { Input } from './Input'
import { Select } from './Select'

describe('Field', () => {
  it('names its control, so clicking the label focuses the input', async () => {
    renderWithProviders(
      <Field label="Member ID">
        <Input />
      </Field>,
    )
    await userEvent.click(screen.getByText('Member ID'))
    expect(screen.getByRole('textbox', { name: 'Member ID' })).toHaveFocus()
  })

  it('announces an error and marks the control invalid', () => {
    renderWithProviders(
      <Field label="Member ID" error="Enter a valid member ID.">
        <Input />
      </Field>,
    )
    const input = screen.getByRole('textbox', { name: 'Member ID' })
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid member ID.')
    expect(input).toHaveAccessibleDescription('Enter a valid member ID.')
  })

  it('describes the control with its help text', () => {
    renderWithProviders(
      <Field label="Tax ID" description="Printed on every claim.">
        <Input />
      </Field>,
    )
    expect(screen.getByRole('textbox', { name: 'Tax ID' })).toHaveAccessibleDescription(
      'Printed on every claim.',
    )
  })

  it('passes required and disabled down to the control it wraps', () => {
    renderWithProviders(
      <Field label="Payer" required disabled>
        <Select options={[{ value: 'a', label: 'A' }]} value={null} onChange={() => undefined} />
      </Field>,
    )
    const select = screen.getByRole('combobox', { name: /payer/i })
    expect(select).toHaveAttribute('aria-required', 'true')
    expect(select).toHaveAttribute('aria-disabled', 'true')
  })

  it('uses a fieldset and legend for a group of controls', () => {
    renderWithProviders(
      <Field label="Scope" asFieldset>
        <Input aria-label="One" />
      </Field>,
    )
    expect(screen.getByRole('group', { name: 'Scope' })).toBeInTheDocument()
  })
})
