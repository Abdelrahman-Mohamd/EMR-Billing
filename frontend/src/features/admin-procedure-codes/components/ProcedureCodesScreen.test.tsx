import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
import { useToastStore } from '@/stores/toast-store'
import { createTestQueryClient, renderWithProviders } from '@/test/render'
import { resetProcedureCodes } from '../data/procedure-code-store'
import type { ProcedureCode } from '../model/procedure-code'

// Frontend only: there is no api to fake. Each test starts the in-tab store
// from a known list.
const code = (overrides: Partial<ProcedureCode> & { code: string }): ProcedureCode => ({
  description: `Description ${overrides.code}`,
  procedureType: 'Therapeutic',
  isTimed: true,
  modifierOverride: false,
  modifiers: [],
  defaultFee: 35,
  isActive: true,
  isNewFromEmr: false,
  ...overrides,
})

beforeEach(() => {
  resetProcedureCodes([
    code({ code: '97110', description: 'Therapeutic exercise' }),
    code({
      code: '97140',
      description: 'Manual therapy techniques',
      modifierOverride: true,
      modifiers: ['GP', '59'],
    }),
    code({
      code: '97033',
      description: 'Iontophoresis',
      procedureType: 'Modality',
      defaultFee: 0,
      isNewFromEmr: true,
    }),
    code({
      code: '97039',
      description: 'Unlisted modality',
      procedureType: 'Modality',
      isTimed: false,
      isActive: false,
    }),
  ])
})
afterEach(() => {
  useToastStore.getState().clear()
})

function renderAt(path = '/setup/procedure-codes') {
  const queryClient = createTestQueryClient()
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { queryClient },
  })
  renderWithProviders(<RouterProvider router={router} />, { queryClient })
}

const table = () => screen.findByRole('table', { name: 'Procedure codes' }, { timeout: 5000 })
const rowOf = async (text: string) =>
  within(await table())
    .getAllByRole('row')
    .find((row) => row.textContent?.includes(text)) as HTMLElement
const textbox = (dialog: HTMLElement, name: RegExp) => within(dialog).getByRole('textbox', { name })

async function openNew() {
  await userEvent.click(await screen.findByRole('button', { name: 'New code' }, { timeout: 5000 }))
  return screen.getByRole('dialog')
}

describe('Setup → Procedure codes', () => {
  it('lists codes as the prototype does, under Setup, with no implementation notice', async () => {
    renderAt()
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Procedure codes' }, { timeout: 5000 }),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('navigation', { name: 'Setup' })).getByRole('link', {
        name: 'Procedure codes',
      }),
    ).toHaveAttribute('data-status', 'active')
    // How the data is held today is architecture, never product copy.
    expect(screen.queryByText(/not saved yet|not connected|browser tab|reloads/i)).not.toBeInTheDocument()

    const headers = within(await table())
      .getAllByRole('columnheader')
      .map((header) => header.textContent)
    // The prototype's columns; its "Timed (8-minute rule)" column is shown under the type.
    expect(headers.slice(0, 6)).toEqual([
      'Code',
      'Description',
      'Type',
      'Modifier override',
      'Default fee',
      'Active',
    ])
    expect(await rowOf('97110')).toHaveTextContent('Timed (8-minute rule)')
    // Sorted by code.
    const rows = within(await table()).getAllByRole('row')
    expect(rows.slice(1).map((row) => row.querySelector('td')?.textContent?.slice(0, 5))).toEqual([
      '97033',
      '97039',
      '97110',
      '97140',
    ])
    expect(await rowOf('97033')).toHaveTextContent('New from EMR')
    expect(await rowOf('97033')).toHaveTextContent('$0.00')
    expect(await rowOf('97140')).toHaveTextContent('GP · 59')
    expect(within(await rowOf('97039')).getByRole('switch', { name: /: active$/ })).not.toBeChecked()
    expect(screen.getByText('4 codes')).toBeInTheDocument()
  })

  it('reactivates a code from its row with the Active switch, at once', async () => {
    renderAt()
    const row = await rowOf('97039')
    const toggle = within(row).getByRole('switch', { name: /^97039 — .*: active$/ })
    expect(toggle).not.toBeChecked()
    await userEvent.click(toggle)
    expect(toggle).toBeChecked()
  })

  it('explains an empty list and offers to add the first code', async () => {
    resetProcedureCodes([])
    renderAt()
    expect(await screen.findByText('No procedure codes yet', {}, { timeout: 5000 })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Add a procedure code' }))
    expect(
      within(screen.getByRole('dialog')).getByRole('heading', { name: 'New procedure code' }),
    ).toBeInTheDocument()
  })

  it('refuses an incomplete, malformed or repeated code', async () => {
    renderAt()
    const dialog = await openNew()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save code' }))
    for (const message of ['Enter the code.', 'Enter the description.', 'Enter the default fee.']) {
      expect(await within(dialog).findByText(message)).toBeInTheDocument()
    }
    await userEvent.type(textbox(dialog, /cpt/i), '9711')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save code' }))
    expect(await within(dialog).findByText('Please enter a valid code.')).toBeInTheDocument()
    await userEvent.type(textbox(dialog, /cpt/i), '0')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save code' }))
    expect(await within(dialog).findByText('This code exists.')).toBeInTheDocument()
  })

  it('adds a code to the list, with placeholders on its fields', async () => {
    renderAt()
    const dialog = await openNew()
    expect(textbox(dialog, /cpt/i)).toHaveAttribute('placeholder', 'Enter code')
    expect(textbox(dialog, /description/i)).toHaveAttribute('placeholder', 'Enter description')
    expect(textbox(dialog, /default fee/i)).toHaveAttribute('placeholder', 'Enter default fee')
    await userEvent.type(textbox(dialog, /cpt/i), 'g0283')
    expect(textbox(dialog, /cpt/i)).toHaveValue('G0283')
    await userEvent.type(textbox(dialog, /description/i), 'Electrical stimulation, unattended (Medicare)')
    await userEvent.type(textbox(dialog, /default fee/i), '16')
    await userEvent.click(within(dialog).getByRole('combobox', { name: /procedure type/i }))
    await userEvent.click(await screen.findByRole('option', { name: 'Modality' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save code' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const added = await rowOf('G0283')
    expect(added).toHaveTextContent('Electrical stimulation, unattended (Medicare)')
    expect(added).toHaveTextContent('$16.00')
    expect(added).toHaveTextContent('Untimed')
    expect(screen.getByText('5 codes')).toBeInTheDocument()
    expect(await screen.findByText('Code saved')).toBeInTheDocument()
  }, 15_000)

  it('keeps Modifier override off until switched on, then offers four modifiers and the warning', async () => {
    renderAt()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Edit 97110 — Therapeutic exercise' }, { timeout: 5000 }),
    )
    const dialog = screen.getByRole('dialog')
    const override = within(dialog).getByRole('switch', { name: 'Modifier override' })
    expect(override).not.toBeChecked()
    expect(within(dialog).queryByRole('textbox', { name: /^modifier/i })).not.toBeInTheDocument()
    expect(within(dialog).queryByText(/will override any modifiers/i)).not.toBeInTheDocument()

    await userEvent.click(override)
    expect(
      within(dialog).getByText('These modifiers will override any modifiers provided from other sources.'),
    ).toBeInTheDocument()
    const inputs = within(dialog).getAllByRole('textbox', { name: /^modifier \d/i })
    expect(inputs.map((input) => input.getAttribute('placeholder'))).toEqual([
      'Optional',
      'Optional',
      'Optional',
      'Optional',
    ])
    await userEvent.type(inputs[0] as HTMLElement, 'gp')
    await userEvent.type(inputs[1] as HTMLElement, 'kx')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save code' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await rowOf('97110')).toHaveTextContent('GP · KX')

    // Switched off again: the inputs and warning go, and the modifiers are not kept.
    await userEvent.click(screen.getByRole('button', { name: 'Edit 97110 — Therapeutic exercise' }))
    const again = screen.getByRole('dialog')
    expect(within(again).getAllByRole('textbox', { name: /^modifier \d/i })[0]).toHaveValue('GP')
    await userEvent.click(within(again).getByRole('switch', { name: 'Modifier override' }))
    expect(within(again).queryByRole('textbox', { name: /^modifier \d/i })).not.toBeInTheDocument()
    expect(within(again).queryByText(/will override any modifiers/i)).not.toBeInTheDocument()
    await userEvent.click(within(again).getByRole('button', { name: 'Save code' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(within(await rowOf('97110')).queryByText('GP · KX')).not.toBeInTheDocument()
  }, 20_000)

  it('edits a code with its values filled in; the code itself stays fixed', async () => {
    renderAt()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Edit 97033 — Iontophoresis' }, { timeout: 5000 }),
    )
    const dialog = screen.getByRole('dialog')
    expect(textbox(dialog, /cpt/i)).toHaveValue('97033')
    expect(textbox(dialog, /cpt/i)).toHaveAttribute('readonly')
    expect(textbox(dialog, /default fee/i)).toHaveValue('0.00')
    expect(within(dialog).getByRole('switch', { name: /^timed/i })).toBeChecked()
    expect(within(dialog).getByRole('switch', { name: 'Active' })).toBeChecked()
    await userEvent.clear(textbox(dialog, /default fee/i))
    await userEvent.type(textbox(dialog, /default fee/i), '28')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save code' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const row = await rowOf('97033')
    expect(row).toHaveTextContent('$28.00')
    // Saving clears the "New from EMR" mark, as in the prototype.
    expect(row).not.toHaveTextContent('New from EMR')
  })

  it('pages 20 codes at a time and sorts by fee', async () => {
    resetProcedureCodes(
      Array.from({ length: 25 }, (_, index) =>
        code({ code: `9${String(7000 + index)}`, defaultFee: 100 - index }),
      ),
    )
    renderAt()
    expect(await screen.findByText('Showing 1–20 of 25 codes', {}, { timeout: 5000 })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(await screen.findByText('Showing 21–25 of 25 codes')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /default fee/i }))
    expect(await screen.findByText('Showing 1–20 of 25 codes')).toBeInTheDocument()
    const firstRow = within(await table()).getAllByRole('row')[1] as HTMLElement
    expect(firstRow).toHaveTextContent('$76.00')
  })
})
