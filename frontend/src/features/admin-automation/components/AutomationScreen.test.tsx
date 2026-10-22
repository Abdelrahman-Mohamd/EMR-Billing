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
    { id: 'daily-18', kind: 'daily', hours: null, time: '18:00', label: 'Every day at 6:00 PM' },
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

const choices = () =>
  screen.findByRole('radiogroup', { name: 'Submit released charges automatically' }, { timeout: 5000 })
const inEffect = () => screen.getByRole('region', { name: 'In effect' })
const toasts = () => useToastStore.getState().toasts
const rowOf = (group: HTMLElement, label: string) =>
  within(group).getByRole('radio', { name: label }).closest('li') as HTMLElement

describe('Admin → Submission & automation', () => {
  it('shows the choices as a list, the one in use marked, and what is in effect beside them', async () => {
    renderAt()
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Submission & automation' }, { timeout: 5000 }),
    ).toBeInTheDocument()
    expect(screen.getByText('When released charges are submitted automatically.')).toBeVisible()
    const group = await choices()
    expect(
      within(group)
        .getAllByRole('radio')
        .map((radio) => radio.getAttribute('value')),
    ).toEqual(['off', 'hourly', '4h', 'daily-18'])
    expect(within(group).getByRole('radio', { name: 'Every day at 6:00 PM' })).toBeChecked()
    expect(rowOf(group, 'Every day at 6:00 PM')).toHaveTextContent('In use')
    // The one in use cannot be deleted; Off is not a schedule.
    expect(within(rowOf(group, 'Every day at 6:00 PM')).queryByRole('button')).not.toBeInTheDocument()
    expect(within(rowOf(group, 'Off — submit manually')).queryByRole('button')).not.toBeInTheDocument()
    expect(within(group).getByRole('button', { name: 'Delete schedule Every hour' })).toBeVisible()

    expect(inEffect()).toHaveTextContent('Every day at 6:00 PM')
    expect(inEffect()).toHaveTextContent('Released chargesSubmitted on schedule')
    expect(inEffect()).toHaveTextContent('Last runNever')
    expect(screen.getByRole('button', { name: 'Save settings' })).toBeDisabled()
    // No dialog to manage the list: it is on the page.
    expect(screen.queryByRole('button', { name: 'Manage the list' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Payer SLA' })).not.toBeInTheDocument()
    expect(screen.queryByText(/backend|not saved|temporary|demo|coming soon|mock/i)).not.toBeInTheDocument()
  })

  it('says when the scheduled job last ran', async () => {
    resetAutomation({
      ...SETTINGS,
      lastScheduledRun: new Date(new Date().setHours(18, 0, 0, 0)).toISOString(),
    })
    renderAt()
    await choices()
    expect(inEffect()).toHaveTextContent('Last runToday 18:00')
  })

  it('saves the setting: off, or an interval', async () => {
    renderAt()
    const group = await choices()
    await userEvent.click(within(group).getByRole('radio', { name: 'Off — submit manually' }))
    expect(screen.getByText('The choice is not saved yet.')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Save settings' }))
    // Saved: in effect, marked in use, and nothing left to save.
    expect(screen.getByRole('button', { name: 'Save settings' })).toBeDisabled()
    expect(screen.queryByText('The choice is not saved yet.')).not.toBeInTheDocument()
    expect(inEffect()).toHaveTextContent('Off — submit manually')
    expect(inEffect()).toHaveTextContent('Submitted by hand')
    expect(rowOf(group, 'Off — submit manually')).toHaveTextContent('In use')
    expect(toasts()).toEqual([
      expect.objectContaining({
        tone: 'success',
        title: 'Settings saved',
        description: 'Released charges are submitted manually.',
      }),
    ])

    await userEvent.click(within(group).getByRole('radio', { name: 'Every 4 hours' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save settings' }))
    expect(toasts().at(-1)).toEqual(
      expect.objectContaining({ description: 'The next scheduled run uses this interval.' }),
    )
    expect(rowOf(group, 'Every 4 hours')).toHaveTextContent('In use')
    // The one no longer in use can be deleted again.
    expect(within(group).getByRole('button', { name: 'Delete schedule Every day at 6:00 PM' })).toBeVisible()
  })

  it('deletes a schedule after asking, and it is no longer offered', async () => {
    renderAt()
    const group = await choices()
    await userEvent.click(within(group).getByRole('button', { name: 'Delete schedule Every hour' }))
    const confirm = screen.getByRole('alertdialog', { name: 'Delete this schedule?' })
    expect(within(confirm).getByText('“Every hour” will no longer be offered.')).toBeVisible()
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete schedule' }))
    await waitFor(() =>
      expect(within(group).queryByRole('radio', { name: 'Every hour' })).not.toBeInTheDocument(),
    )
  })

  it('adds a schedule — the field shown follows How often, with the prototype’s checks', async () => {
    renderAt()
    const group = await choices()
    const add = screen.getByRole('region', { name: 'Add a schedule' })
    // Every day at a time: At, 18:00 to start with.
    expect(within(add).getByRole('combobox', { name: 'How often' })).toHaveTextContent('Every day at a time')
    // Our own time field: the time typed, AM / PM picked beside it.
    expect(within(add).getByRole('textbox', { name: 'At' })).toHaveValue('6:00')
    expect(within(add).getByRole('combobox', { name: 'AM or PM' })).toHaveTextContent('PM')
    expect(within(add).queryByRole('spinbutton')).not.toBeInTheDocument()

    // The same schedule again is refused.
    await userEvent.click(within(add).getByRole('button', { name: 'Add schedule' }))
    await waitFor(() =>
      expect(toasts()).toEqual([
        expect.objectContaining({
          tone: 'warning',
          title: 'Already on the list',
          description: '“Every day at 6:00 PM” is already a schedule.',
        }),
      ]),
    )

    // Every few hours: Every (hours) instead of At, from 1 to 12.
    await userEvent.click(within(add).getByRole('combobox', { name: 'How often' }))
    await userEvent.click(screen.getByRole('option', { name: 'Every few hours' }))
    expect(within(add).queryByRole('textbox', { name: 'At' })).not.toBeInTheDocument()
    const hours = within(add).getByRole('spinbutton', { name: /every \(hours\)/i })
    await userEvent.clear(hours)
    await userEvent.click(within(add).getByRole('button', { name: 'Add schedule' }))
    expect(await within(add).findByText('Say how many hours apart.')).toBeVisible()
    await userEvent.type(hours, '6')
    await userEvent.click(within(add).getByRole('button', { name: 'Add schedule' }))
    await waitFor(() =>
      expect(toasts().at(-1)).toEqual(
        expect.objectContaining({
          tone: 'success',
          title: 'Schedule added',
          description: '“Every 6 hours” can now be chosen.',
        }),
      ),
    )
    // Offered at once, not in use until saved.
    expect(within(group).getByRole('radio', { name: 'Every 6 hours' })).not.toBeChecked()

    // Weekdays at a time.
    await userEvent.click(within(add).getByRole('combobox', { name: 'How often' }))
    await userEvent.click(screen.getByRole('option', { name: 'Weekdays at a time' }))
    const at = within(add).getByRole('textbox', { name: 'At' })
    await userEvent.clear(at)
    await userEvent.click(within(add).getByRole('button', { name: 'Add schedule' }))
    expect(await within(add).findByText('Enter a time, e.g. 6:07.')).toBeVisible()
    // Any minute, not only a listed one.
    await userEvent.type(at, '7:32')
    await userEvent.click(within(add).getByRole('combobox', { name: 'AM or PM' }))
    await userEvent.click(await screen.findByRole('option', { name: 'AM' }))
    await userEvent.click(within(add).getByRole('button', { name: 'Add schedule' }))
    await waitFor(() =>
      expect(within(group).getByRole('radio', { name: 'Weekdays at 7:32 AM' })).toBeInTheDocument(),
    )
  })

  it('says what to do with no schedules yet', async () => {
    resetAutomation({ schedule: 'off', options: [], lastScheduledRun: null })
    renderAt()
    const group = await choices()
    expect(within(group).getByRole('radio', { name: 'Off — submit manually' })).toBeChecked()
    expect(within(group).getByText('No schedules yet — add one below.')).toBeVisible()
    expect(inEffect()).toHaveTextContent('Submitted by hand')
  })
})
