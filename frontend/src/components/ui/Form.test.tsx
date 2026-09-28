import { describe, expect, it, vi } from 'vitest'
import { renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { renderWithProviders } from '@/test/render'
import { ApiError } from '@/lib/api/api-error'
import { Button } from './Button'
import { FormGrid } from './Field'
import { Form, FormField, applyServerErrors } from './Form'
import { Input } from './Input'

const schema = z.object({
  memberId: z.string().min(1, 'Member ID is required.'),
  groupNumber: z.string().min(1, 'Group number is required.'),
})
type Values = z.infer<typeof schema>

function CoverageForm({ onSubmit }: { onSubmit: (values: Values) => void }) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { memberId: '', groupNumber: '' },
  })
  return (
    <Form form={form} onSubmit={onSubmit}>
      <FormGrid>
        <FormField name="memberId" label="Member ID" required span={6}>
          {(field) => <Input {...field} />}
        </FormField>
        <FormField name="groupNumber" label="Group number" span={6}>
          {(field) => <Input {...field} />}
        </FormField>
      </FormGrid>
      <Button type="submit" variant="primary">
        Save
      </Button>
    </Form>
  )
}

describe('Form', () => {
  it('blocks submission and shows the schema message on the field that failed', async () => {
    const onSubmit = vi.fn()
    renderWithProviders(<CoverageForm onSubmit={onSubmit} />)

    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(await screen.findByText('Member ID is required.')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /member id/i })).toHaveAttribute('aria-invalid', 'true')
  })

  it('submits the typed values once the form is valid', async () => {
    const onSubmit = vi.fn()
    renderWithProviders(<CoverageForm onSubmit={onSubmit} />)

    await userEvent.type(screen.getByRole('textbox', { name: /member id/i }), '1EG4-TE5-MK72')
    await userEvent.type(screen.getByRole('textbox', { name: /group number/i }), 'AARP-F')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ memberId: '1EG4-TE5-MK72', groupNumber: 'AARP-F' }),
        expect.anything(),
      ),
    )
  })

  it('keeps what was typed when validation fails', async () => {
    renderWithProviders(<CoverageForm onSubmit={vi.fn()} />)
    const memberId = screen.getByRole('textbox', { name: /member id/i })
    await userEvent.type(memberId, 'ABC123')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(memberId).toHaveValue('ABC123')
  })
})

describe('applyServerErrors', () => {
  it('puts a rejected field back on its own field', async () => {
    const { result } = renderHook(() => useForm<Values>({ defaultValues: { memberId: '', groupNumber: '' } }))
    const form = result.current
    renderWithProviders(
      <Form form={form} onSubmit={vi.fn()}>
        <FormField name="memberId" label="Member ID">
          {(field) => <Input {...field} />}
        </FormField>
      </Form>,
    )

    const error = new ApiError({
      kind: 'validation',
      message: 'Some fields need attention.',
      status: 422,
      fieldErrors: [{ path: 'memberId', message: 'The payer does not recognise this member ID.' }],
    })
    const leftover = applyServerErrors(form, error)

    expect(leftover).toBeNull()
    expect(await screen.findByText('The payer does not recognise this member ID.')).toBeInTheDocument()
  })

  it('returns a message for an error that belongs to no field', () => {
    const form = { getValues: () => ({ memberId: '' }), setError: vi.fn() } as unknown as ReturnType<
      typeof useForm<Values>
    >
    const error = new ApiError({
      kind: 'validation',
      message: 'Some fields need attention.',
      fieldErrors: [{ path: 'coverage.rank', message: 'A primary coverage already exists.' }],
    })
    expect(applyServerErrors(form, error)).toBe('A primary coverage already exists.')
  })

  it('never shows the raw text of an unexpected failure', () => {
    const form = { getValues: () => ({}), setError: vi.fn() } as unknown as ReturnType<typeof useForm<Values>>
    const error = new ApiError({ kind: 'server', message: 'psycopg2 UniqueViolation', status: 500 })
    expect(applyServerErrors(form, error)).toBeNull()
  })
})
