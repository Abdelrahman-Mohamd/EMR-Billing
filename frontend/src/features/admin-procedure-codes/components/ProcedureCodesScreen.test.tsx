import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
import { ApiError } from '@/lib/api/api-error'
import { useToastStore } from '@/stores/toast-store'
import { createTestQueryClient, renderWithProviders } from '@/test/render'
import {
  createProcedureCode,
  deleteProcedureCode,
  getProcedureCode,
  listProcedureCodes,
  setProcedureCodeActive,
  updateProcedureCode,
} from '../api/procedure-codes-api'
import { procedureCodeResponseSchema, type ProcedureCode } from '../schemas/procedure-code'
import { toProcedureCodePayload, type ProcedureCodeFormValues } from '../schemas/procedure-code-form'

// Only the integration point is faked: this feature's api functions, answering
// as the server does. Everything above them runs for real.
vi.mock('../api/procedure-codes-api', () => ({
  listProcedureCodes: vi.fn(),
  getProcedureCode: vi.fn(),
  createProcedureCode: vi.fn(),
  updateProcedureCode: vi.fn(),
  setProcedureCodeActive: vi.fn(),
  setProcedureCodeDefaultFee: vi.fn(),
  deleteProcedureCode: vi.fn(),
}))
const listMock = vi.mocked(listProcedureCodes)
const getMock = vi.mocked(getProcedureCode)
const createMock = vi.mocked(createProcedureCode)
const updateMock = vi.mocked(updateProcedureCode)
const setActiveMock = vi.mocked(setProcedureCodeActive)
const deleteMock = vi.mocked(deleteProcedureCode)

const LABELS: Record<string, string> = { therapeutic: 'Therapeutic', modality: 'Modality' }

/** A code as the server sends it (2026-10-08), parsed by the real schema. */
function code(id: number, overrides: Record<string, unknown> & { code: string }): ProcedureCode {
  const type = typeof overrides.procedure_type === 'string' ? overrides.procedure_type : 'therapeutic'
  return procedureCodeResponseSchema.parse({
    id,
    description: `Description ${overrides.code}`,
    is_timed: true,
    modifier_override: false,
    modifiers: [],
    default_fee: '35.00',
    procedure_type: type,
    procedure_type_label: LABELS[type],
    is_active: true,
    ...overrides,
  })
}

/** What the server would hold after a save with these values. */
function saved(id: number, values: ProcedureCodeFormValues): ProcedureCode {
  const payload = toProcedureCodePayload(values)
  return code(id, {
    ...payload,
    default_fee: payload.default_fee.toFixed(2),
    procedure_type_label: LABELS[payload.procedure_type],
  })
}

let codes: ProcedureCode[]

beforeEach(() => {
  codes = [
    code(1, { code: '97110', description: 'Therapeutic exercise' }),
    code(2, {
      code: '97140',
      description: 'Manual therapy techniques',
      modifier_override: true,
      modifiers: ['GP', '59'],
    }),
    code(3, { code: '97033', description: 'Iontophoresis', procedure_type: 'modality', default_fee: '0.00' }),
    code(4, {
      code: '97039',
      description: 'Unlisted modality',
      procedure_type: 'modality',
      is_timed: false,
      is_active: false,
    }),
  ]
  listMock.mockReset().mockImplementation(() => Promise.resolve(structuredClone(codes)))
  getMock.mockReset().mockImplementation((id) => {
    const found = codes.find((item) => item.id === id)
    return found
      ? Promise.resolve(structuredClone(found))
      : Promise.reject(new ApiError({ kind: 'not_found', message: 'Not found', status: 404 }))
  })
  createMock.mockReset().mockImplementation((values) => {
    codes = [...codes, saved(9, values)]
    return Promise.resolve('Procedure code created successfully')
  })
  updateMock.mockReset().mockImplementation((id, values) => {
    codes = codes.map((item) => (item.id === id ? saved(id, values) : item))
    return Promise.resolve('Procedure code updated successfully')
  })
  setActiveMock.mockReset().mockImplementation((id, isActive) => {
    codes = codes.map((item) => (item.id === id ? { ...item, isActive } : item))
    return Promise.resolve('Procedure code updated successfully')
  })
  deleteMock.mockReset().mockImplementation((id) => {
    codes = codes.filter((item) => item.id !== id)
    return Promise.resolve('Procedure code deleted successfully')
  })
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

async function openEdit(name: string) {
  await userEvent.click(await screen.findByRole('button', { name: `Edit ${name}` }, { timeout: 5000 }))
  const dialog = screen.getByRole('dialog')
  // The form waits for the code as the server has it now.
  await within(dialog).findByRole('textbox', { name: /cpt/i })
  return dialog
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
    // In the server's order — nothing is sorted in the browser — and no column offers a sort.
    const rows = within(await table()).getAllByRole('row')
    expect(within(await table()).queryAllByRole('button', { name: /sort|code|fee/i })).toEqual([])
    expect(rows.slice(1).map((row) => row.querySelector('td')?.textContent?.slice(0, 5))).toEqual([
      '97110',
      '97140',
      '97033',
      '97039',
    ])
    // The server's label for the type; $0.00 marked; no "New from EMR" (not in the contract).
    expect(await rowOf('97033')).toHaveTextContent('Modality')
    expect(await rowOf('97033')).toHaveTextContent('$0.00')
    expect(screen.queryByText('New from EMR')).not.toBeInTheDocument()
    expect(await rowOf('97140')).toHaveTextContent('GP · 59')
    expect(within(await rowOf('97039')).getByRole('switch', { name: /: active$/ })).not.toBeChecked()
    expect(screen.getByText('4 codes')).toBeInTheDocument()
  })

  it('shows a failed load with a retry', async () => {
    listMock.mockRejectedValueOnce(new ApiError({ kind: 'unavailable', message: 'Down.' }))
    renderAt()
    await userEvent.click(await screen.findByRole('button', { name: /try again/i }, { timeout: 5000 }))
    expect(await rowOf('97110')).toBeDefined()
  })

  it('reactivates a code from its row with the Active switch, after asking', async () => {
    renderAt()
    const row = await rowOf('97039')
    const toggle = within(row).getByRole('switch', { name: /^97039 — .*: active$/ })
    expect(toggle).not.toBeChecked()
    await userEvent.click(toggle)
    const ask = await screen.findByRole('alertdialog', { name: 'Reactivate 97039?' })
    expect(ask).toHaveTextContent('Its status becomes Active again.')
    expect(setActiveMock).not.toHaveBeenCalled()
    await userEvent.click(within(ask).getByRole('button', { name: 'Reactivate' }))
    await waitFor(() => expect(toggle).toBeChecked())
    expect(setActiveMock).toHaveBeenCalledWith(4, true)
    expect(screen.getByRole('status')).toHaveTextContent('Procedure code updated successfully')
  })

  it('explains an empty list and offers to add the first code', async () => {
    codes = []
    renderAt()
    expect(await screen.findByText('No procedure codes yet', {}, { timeout: 5000 })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Add a procedure code' }))
    expect(
      within(screen.getByRole('dialog')).getByRole('heading', { name: 'New procedure code' }),
    ).toBeInTheDocument()
  })

  it('refuses an incomplete or malformed code, and shows the server’s word on a repeated one', async () => {
    createMock.mockRejectedValueOnce(
      new ApiError({
        kind: 'validation',
        message: 'The code has already been taken.',
        fieldErrors: [{ path: 'code', message: 'The code has already been taken.' }],
      }),
    )
    renderAt()
    const dialog = await openNew()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save code' }))
    for (const message of ['Enter the code.', 'Enter the description.']) {
      expect(await within(dialog).findByText(message)).toBeInTheDocument()
    }
    // The default fee is not required: the server keeps $0.00.
    expect(within(dialog).queryByText('Enter the default fee.')).not.toBeInTheDocument()
    await userEvent.type(textbox(dialog, /cpt/i), '9711')
    await userEvent.type(textbox(dialog, /description/i), 'Therapeutic exercise')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save code' }))
    expect(await within(dialog).findByText('Please enter a valid code.')).toBeInTheDocument()
    await userEvent.type(textbox(dialog, /cpt/i), '0')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save code' }))
    expect(await within(dialog).findByText('The code has already been taken.')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  }, 15_000)

  it('adds a code to the list, with placeholders on its fields and the server’s message', async () => {
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
    expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual([
      'Evaluation',
      'Therapeutic',
      'Modality',
      'Supply / DME',
      'Other',
    ])
    await userEvent.click(await screen.findByRole('option', { name: 'Modality' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save code' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'G0283', defaultFee: '16', procedureType: 'modality' }),
    )
    const added = await rowOf('G0283')
    expect(added).toHaveTextContent('Electrical stimulation, unattended (Medicare)')
    expect(added).toHaveTextContent('$16.00')
    expect(added).toHaveTextContent('Untimed')
    expect(screen.getByText('5 codes')).toBeInTheDocument()
    expect(await screen.findByText('Procedure code created successfully')).toBeInTheDocument()
  }, 15_000)

  it('keeps Modifier override off until switched on, then offers four modifiers and the warning', async () => {
    renderAt()
    const dialog = await openEdit('97110 — Therapeutic exercise')
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
      'Enter modifier',
      'Enter modifier',
      'Enter modifier',
      'Enter modifier',
    ])
    // On, it needs at least one modifier — as the server does.
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save code' }))
    expect(await within(dialog).findByText('Add at least one modifier.')).toBeInTheDocument()
    await userEvent.type(inputs[0] as HTMLElement, 'gp')
    await userEvent.type(inputs[1] as HTMLElement, 'kx')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save code' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await rowOf('97110')).toHaveTextContent('GP · KX')

    // Switched off again: the inputs and warning go, and the modifiers are not kept.
    const again = await openEdit('97110 — Therapeutic exercise')
    expect(within(again).getAllByRole('textbox', { name: /^modifier \d/i })[0]).toHaveValue('GP')
    await userEvent.click(within(again).getByRole('switch', { name: 'Modifier override' }))
    expect(within(again).queryByRole('textbox', { name: /^modifier \d/i })).not.toBeInTheDocument()
    expect(within(again).queryByText(/will override any modifiers/i)).not.toBeInTheDocument()
    await userEvent.click(within(again).getByRole('button', { name: 'Save code' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(updateMock).toHaveBeenLastCalledWith(1, expect.objectContaining({ modifierOverride: false }))
    await waitFor(async () =>
      expect(within(await rowOf('97110')).queryByText('GP · KX')).not.toBeInTheDocument(),
    )
  }, 20_000)

  it('edits a code as the server has it now, the code itself included', async () => {
    renderAt()
    const dialog = await openEdit('97033 — Iontophoresis')
    expect(getMock).toHaveBeenCalledWith(3, expect.anything())
    expect(textbox(dialog, /cpt/i)).toHaveValue('97033')
    expect(textbox(dialog, /cpt/i)).not.toHaveAttribute('readonly')
    expect(textbox(dialog, /default fee/i)).toHaveValue('0.00')
    expect(within(dialog).getByRole('switch', { name: /^timed/i })).toBeChecked()
    expect(within(dialog).getByRole('switch', { name: 'Active' })).toBeChecked()
    await userEvent.clear(textbox(dialog, /cpt/i))
    await userEvent.type(textbox(dialog, /cpt/i), '97035')
    await userEvent.clear(textbox(dialog, /default fee/i))
    await userEvent.type(textbox(dialog, /default fee/i), '28')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save code' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(updateMock).toHaveBeenCalledWith(3, expect.objectContaining({ code: '97035', defaultFee: '28' }))
    expect(await rowOf('97035')).toHaveTextContent('$28.00')
    expect(await screen.findByText('Procedure code updated successfully')).toBeInTheDocument()
  })

  it('deletes a code after asking, and says why when the server refuses', async () => {
    renderAt()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Delete 97039 — Unlisted modality' }, { timeout: 5000 }),
    )
    const confirm = await screen.findByRole('alertdialog', { name: 'Delete 97039?' })
    expect(confirm).toHaveTextContent('Its fee-schedule prices are deleted too.')
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete code' }))
    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith(4))
    expect(await screen.findByText('Procedure code deleted successfully')).toBeInTheDocument()

    deleteMock.mockRejectedValueOnce(
      new ApiError({
        kind: 'validation',
        message: 'This code is used by charge lines.',
        serverMessage: 'This code is used by charge lines.',
        status: 422,
      }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Delete 97110 — Therapeutic exercise' }))
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete code' }),
    )
    await waitFor(() =>
      expect(useToastStore.getState().toasts.at(-1)).toEqual(
        expect.objectContaining({
          tone: 'error',
          title: '97110 was not deleted',
          description: 'This code is used by charge lines.',
        }),
      ),
    )
  }, 15_000)

  it('pages 20 codes at a time, in the server’s order', async () => {
    codes = Array.from({ length: 25 }, (_, index) =>
      code(index + 1, { code: `9${String(7000 + index)}`, default_fee: (100 - index).toFixed(2) }),
    )
    renderAt()
    expect(await screen.findByText('Showing 1–20 of 25 codes', {}, { timeout: 5000 })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(await screen.findByText('Showing 21–25 of 25 codes')).toBeInTheDocument()
    const firstRow = within(await table()).getAllByRole('row')[1] as HTMLElement
    expect(firstRow).toHaveTextContent('97020')
    expect(screen.queryByRole('button', { name: /default fee/i })).not.toBeInTheDocument()
  })
})
