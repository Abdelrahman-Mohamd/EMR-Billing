import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
import { useToastStore } from '@/stores/toast-store'
import { createTestQueryClient, renderWithProviders } from '@/test/render'
import { resetAutomation } from '../data/automation-store'
import type { AutomationSettings } from '../model/schedule'

// Frontend only: there is no api to fake. Each test starts the in-tab store
// from known settings.
const SETTINGS: AutomationSettings = {
  schedule: 'daily-18',
  options: [
    { id: 'hourly', kind: 'hours', hours: 1, time: null, label: 'Every hour' },
    { id: '4h', kind: 'hours', hours: 4, time: null, label: 'Every 4 hours' },
    { id: 'daily-18', kind: 'daily', hours: null, time: '18:00', label: 'Every day at 18:00' },
  ],
  lastScheduledRun: null,
}

beforeEach(() => resetAutomation(SETTINGS))
afterEach(() => {
  useToastStore.getState().clear()
})

function renderAt(path = '/admin/automation') {
  const queryClient = createTestQueryClient()
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { queryClient },
  })
  renderWithProviders(<RouterProvider router={router} />, { queryClient })
}

const setting = () =>
  screen.findByRole('combobox', { name: 'Submit released charges automatically' }, { timeout: 5000 })
const toasts = () => useToastStore.getState().toasts

async function openList() {
  await setting()
  await userEvent.click(screen.getByRole('button', { name: 'Manage the list' }))
  return screen.getByRole('dialog', { name: 'Scheduled submission options' })
}

describe('Admin → Submission & automation', () => {
  it('shows the setting, its options and when it last ran, as the prototype does', async () => {
    renderAt()
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Submission & automation' }, { timeout: 5000 }),
    ).toBeInTheDocument()
    expect(screen.getByText('When released charges are submitted automatically.')).toBeVisible()
    const select = await setting()
    expect(select).toHaveTextContent('Every day at 18:00')
    expect(screen.getByText('Last run never.')).toBeVisible()
    // What is in effect, beside the section title; nothing to save yet.
    const section = screen.getByRole('region', { name: 'Scheduled submission' })
    expect(within(section).getAllByText('Every day at 18:00').length).toBeGreaterThan(1)
    expect(screen.getByRole('button', { name: 'Save settings' })).toBeDisabled()

    await userEvent.click(select)
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Off — submit manually',
      'Every hour',
      'Every 4 hours',
      'Every day at 18:00',
    ])
    await userEvent.keyboard('{Escape}')

    expect(screen.getByRole('heading', { level: 2, name: 'Scheduled submission' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Payer SLA' })).not.toBeInTheDocument()
    expect(screen.queryByText(/The list is yours to fill/)).not.toBeInTheDocument()
    expect(screen.queryByText(/backend|not saved|temporary|demo|coming soon|mock/i)).not.toBeInTheDocument()
  })

  it('says when the scheduled job last ran', async () => {
    resetAutomation({
      ...SETTINGS,
      lastScheduledRun: new Date(new Date().setHours(18, 0, 0, 0)).toISOString(),
    })
    renderAt()
    await setting()
    expect(screen.getByText('Last run Today 18:00.')).toBeVisible()
  })

  it('saves the setting: off, or an interval', async () => {
    renderAt()
    await userEvent.click(await setting())
    await userEvent.click(screen.getByRole('option', { name: 'Off — submit manually' }))
    expect(screen.getByRole('button', { name: 'Save settings' })).toBeEnabled()
    await userEvent.click(screen.getByRole('button', { name: 'Save settings' }))
    // Saved: in effect beside the title, and nothing left to save.
    expect(screen.getByRole('button', { name: 'Save settings' })).toBeDisabled()
    expect(
      within(screen.getByRole('region', { name: 'Scheduled submission' })).getAllByText(
        'Off — submit manually',
      ).length,
    ).toBeGreaterThan(1)
    expect(toasts()).toEqual([
      expect.objectContaining({
        tone: 'success',
        title: 'Settings saved',
        description: 'Released charges are submitted manually.',
      }),
    ])

    await userEvent.click(await setting())
    await userEvent.click(screen.getByRole('option', { name: 'Every 4 hours' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save settings' }))
    expect(toasts().at(-1)).toEqual(
      expect.objectContaining({ description: 'The next scheduled run uses this interval.' }),
    )
    // The saved option is the one in use.
    const dialog = await openList()
    const row = within(dialog).getByText('Every 4 hours').closest('tr') as HTMLElement
    expect(row).toHaveTextContent('In use')
  })

  it('lists the options, marks the one in use, and never offers to remove it', async () => {
    renderAt()
    const dialog = await openList()
    expect(
      within(dialog).getByText(
        'What the dropdown on this screen offers. The option in use cannot be removed.',
      ),
    ).toBeVisible()
    const inUse = within(dialog).getByText('Every day at 18:00').closest('tr') as HTMLElement
    expect(inUse).toHaveTextContent('In use')
    expect(within(inUse).queryByRole('button')).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Remove Every hour' })).toBeVisible()
  })

  it('removes an option after asking, and the dropdown no longer offers it', async () => {
    renderAt()
    const dialog = await openList()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove Every hour' }))
    const confirm = screen.getByRole('alertdialog', { name: 'Remove this option?' })
    expect(within(confirm).getByText('“Every hour” will no longer be offered.')).toBeVisible()
    await userEvent.click(within(confirm).getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(within(dialog).queryByText('Every hour')).not.toBeInTheDocument())

    // The footer's Close (the × in the corner is named Close too).
    await userEvent.click(within(dialog).getAllByRole('button', { name: 'Close' }).at(-1) as HTMLElement)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await userEvent.click(await setting())
    expect(screen.queryByRole('option', { name: 'Every hour' })).not.toBeInTheDocument()
  })

  it('adds an option — the field shown follows How often, with the prototype’s checks', async () => {
    renderAt()
    const dialog = await openList()
    // Every day at a time: At, 18:00 to start with.
    expect(within(dialog).getByRole('combobox', { name: 'How often' })).toHaveTextContent(
      'Every day at a time',
    )
    const at = within(dialog).getByLabelText('At')
    expect(at).toHaveValue('18:00')
    expect(within(dialog).queryByLabelText(/every \(hours\)/i)).not.toBeInTheDocument()

    // The same option again is refused.
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add option' }))
    await waitFor(() =>
      expect(toasts()).toEqual([
        expect.objectContaining({
          tone: 'warning',
          title: 'Already on the list',
          description: '“Every day at 18:00” is already an option.',
        }),
      ]),
    )

    // Every few hours: Every (hours) instead of At, from 1 to 12.
    await userEvent.click(within(dialog).getByRole('combobox', { name: 'How often' }))
    await userEvent.click(screen.getByRole('option', { name: 'Every few hours' }))
    expect(within(dialog).queryByLabelText('At')).not.toBeInTheDocument()
    const hours = within(dialog).getByRole('spinbutton', { name: /every \(hours\)/i })
    await userEvent.clear(hours)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add option' }))
    expect(await within(dialog).findByText('Say how many hours apart.')).toBeVisible()
    await userEvent.type(hours, '6')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add option' }))
    await waitFor(() =>
      expect(toasts().at(-1)).toEqual(
        expect.objectContaining({
          tone: 'success',
          title: 'Option added',
          description: '“Every 6 hours” is now in the dropdown.',
        }),
      ),
    )
    expect(within(dialog).getByText('Every 6 hours')).toBeInTheDocument()

    // Weekdays at a time.
    await userEvent.click(within(dialog).getByRole('combobox', { name: 'How often' }))
    await userEvent.click(screen.getByRole('option', { name: 'Weekdays at a time' }))
    const weekdaysAt = within(dialog).getByLabelText('At')
    await userEvent.clear(weekdaysAt)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add option' }))
    expect(await within(dialog).findByText('Choose a time of day.')).toBeVisible()
    await userEvent.type(weekdaysAt, '07:30')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add option' }))
    await waitFor(() => expect(within(dialog).getByText('Weekdays at 07:30')).toBeInTheDocument())

    // Offered by the setting at once.
    // The footer's Close (the × in the corner is named Close too).
    await userEvent.click(within(dialog).getAllByRole('button', { name: 'Close' }).at(-1) as HTMLElement)
    await userEvent.click(await setting())
    expect(screen.getByRole('option', { name: 'Weekdays at 07:30' })).toBeInTheDocument()
  })

  it('says how it works with no options yet', async () => {
    resetAutomation({ schedule: 'off', options: [], lastScheduledRun: null })
    renderAt()
    expect(await setting()).toHaveTextContent('Off — submit manually')
    const dialog = await openList()
    expect(within(dialog).getByText('No options yet')).toBeVisible()
    expect(
      within(dialog).getByText('Without one, released charges are only submitted by hand.'),
    ).toBeVisible()
  })
})
