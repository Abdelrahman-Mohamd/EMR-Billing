import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { Button } from './Button'
import { ConfirmDialog, Dialog } from './Dialog'
import { Input } from './Input'

function DialogHarness({ dismissible = true }: { dismissible?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open</Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Edit practice"
        description="Practice-level metadata."
        dismissible={dismissible}
        footer={<Button variant="primary">Save</Button>}
      >
        <Input aria-label="Legal name" />
      </Dialog>
    </>
  )
}

describe('Dialog', () => {
  it('opens as a modal with its title and description announced', async () => {
    renderWithProviders(<DialogHarness />)
    await userEvent.click(screen.getByRole('button', { name: 'Open' }))

    const dialog = screen.getByRole('dialog', { name: 'Edit practice' })
    expect(dialog).toHaveAccessibleDescription('Practice-level metadata.')
  })

  it('moves focus inside and returns it to the trigger on close', async () => {
    renderWithProviders(<DialogHarness />)
    const trigger = screen.getByRole('button', { name: 'Open' })
    await userEvent.click(trigger)

    await waitFor(() => expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true))

    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('stays open on Escape when there is unsaved work', async () => {
    renderWithProviders(<DialogHarness dismissible={false} />)
    await userEvent.click(screen.getByRole('button', { name: 'Open' }))
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

describe('ConfirmDialog', () => {
  it('confirms only when the confirming button is pressed', async () => {
    const onConfirm = vi.fn()
    function Harness() {
      const [open, setOpen] = useState(true)
      return (
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          title="Void this claim?"
          description="A voided claim cannot be reopened."
          confirmLabel="Void claim"
          tone="destructive"
          onConfirm={onConfirm}
        />
      )
    }
    renderWithProviders(<Harness />)

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onConfirm).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  })

  it('waits for an async confirmation before closing, and shows it is busy', async () => {
    let resolve: () => void = () => undefined
    const onConfirm = vi.fn(() => new Promise<void>((r) => (resolve = r)))
    function Harness() {
      const [open, setOpen] = useState(true)
      return (
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          title="Release claims?"
          confirmLabel="Release"
          onConfirm={onConfirm}
        />
      )
    }
    renderWithProviders(<Harness />)

    await userEvent.click(screen.getByRole('button', { name: 'Release' }))
    expect(onConfirm).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Release' })).toHaveAttribute('aria-busy', 'true')

    resolve()
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  })

  it('is an alert dialog with its question and context, starting on Cancel, with no close button', async () => {
    renderWithProviders(
      <ConfirmDialog
        open
        onOpenChange={() => undefined}
        title="Sign out?"
        description="You will return to the sign-in screen."
        confirmLabel="Sign out"
        tone="destructive"
        onConfirm={() => undefined}
      />,
    )
    const dialog = screen.getByRole('alertdialog', { name: 'Sign out?' })
    expect(dialog).toHaveAccessibleDescription('You will return to the sign-in screen.')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus())
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
  })

  it('closes on Escape, but not while the confirmation is still working', async () => {
    const onOpenChange = vi.fn()
    renderWithProviders(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Release claims?"
        confirmLabel="Release"
        onConfirm={() => new Promise<void>(() => undefined)}
      />,
    )
    await userEvent.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
    onOpenChange.mockClear()
    await userEvent.click(screen.getByRole('button', { name: 'Release' }))
    await userEvent.keyboard('{Escape}')
    expect(onOpenChange).not.toHaveBeenCalled()
  })
})
