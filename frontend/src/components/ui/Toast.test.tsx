import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { toast, useToastStore } from '@/stores/toast-store'
import { Toaster } from './Toast'

afterEach(() => {
  useToastStore.getState().clear()
  vi.useRealTimers()
})

describe('Toaster', () => {
  it('shows a message and lets it be dismissed', async () => {
    renderWithProviders(<Toaster />)
    act(() => {
      toast.success('Claim released', 'Sent as EDI 837P.')
    })

    expect(screen.getByRole('status')).toHaveTextContent('Claim released')
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByText('Claim released')).not.toBeInTheDocument()
  })

  it('interrupts for an error and waits politely for anything else', () => {
    renderWithProviders(<Toaster />)
    act(() => {
      toast.error('Could not save')
      toast.info('Nothing to submit')
    })
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save')
    expect(screen.getByRole('status')).toHaveTextContent('Nothing to submit')
  })

  it('clears itself after its time is up', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    renderWithProviders(<Toaster />)
    act(() => {
      toast.success('Saved')
    })
    act(() => {
      vi.advanceTimersByTime(5100)
    })
    await waitFor(() => expect(screen.queryByText('Saved')).not.toBeInTheDocument())
  })
})
