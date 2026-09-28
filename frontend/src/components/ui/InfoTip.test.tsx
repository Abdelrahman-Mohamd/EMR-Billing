import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { Field } from './Field'
import { Input } from './Input'
import { RadioGroup } from './Choice'
import { InfoTip } from './InfoTip'

const TEXT = 'Printed on claims as the billing provider’s tax number.'

describe('InfoTip', () => {
  it('is a named button that carries its explanation even while closed', () => {
    renderWithProviders(<InfoTip label="About Tax ID">{TEXT}</InfoTip>)
    const button = screen.getByRole('button', { name: 'About Tax ID' })
    expect(button).toHaveAccessibleDescription(TEXT)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('opens on hover and closes when the pointer leaves', async () => {
    renderWithProviders(<InfoTip label="About Tax ID">{TEXT}</InfoTip>)
    const button = screen.getByRole('button', { name: 'About Tax ID' })
    await userEvent.hover(button)
    expect(await screen.findByRole('tooltip')).toHaveTextContent(TEXT)
    await userEvent.unhover(button)
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument())
  })

  it('opens on keyboard focus, closes on Escape, and keeps focus on the icon', async () => {
    renderWithProviders(<InfoTip label="About Tax ID">{TEXT}</InfoTip>)
    await userEvent.tab()
    const button = screen.getByRole('button', { name: 'About Tax ID' })
    expect(button).toHaveFocus()
    expect(await screen.findByRole('tooltip')).toHaveTextContent(TEXT)
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument())
    expect(button).toHaveFocus()
  })

  it('opens on a tap or click and stays open', async () => {
    renderWithProviders(<InfoTip label="About Tax ID">{TEXT}</InfoTip>)
    await userEvent.click(screen.getByRole('button', { name: 'About Tax ID' }))
    expect(await screen.findByRole('tooltip')).toBeInTheDocument()
  })
})

describe('Field with info', () => {
  it('puts the icon beside the label without changing the field’s name', () => {
    renderWithProviders(
      <Field label="Tax ID" info={TEXT} required>
        <Input />
      </Field>,
    )
    expect(screen.getByRole('textbox', { name: 'Tax ID' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'About Tax ID' })).toHaveAccessibleDescription(TEXT)
  })

  it('keeps a group named by its label alone', () => {
    renderWithProviders(
      <Field label="Scope" info="Which practices the report covers." asFieldset>
        <RadioGroup
          name="scope"
          value="all"
          onValueChange={() => undefined}
          options={[{ value: 'all', label: 'All practices' }]}
        />
      </Field>,
    )
    expect(screen.getByRole('group', { name: 'Scope' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'About Scope' })).toBeInTheDocument()
  })
})
