import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
import { ApiError } from '@/lib/api/api-error'
import { todayIso } from '@/lib/utils/dates'
import { useToastStore } from '@/stores/toast-store'
import { createTestQueryClient, renderWithProviders } from '@/test/render'
import type { Insurance } from '@/features/admin-insurances'
import type { Practice } from '@/features/admin-practices'
import type { ProcedureCode } from '@/features/admin-procedure-codes'
import { resetFeeSchedules } from '../data/fee-schedule-store'

// Frontend only: no fee-schedule api exists to fake. The insurances and
// practices lists are faked at their integration points; the procedure codes
// (an in-tab list of their own) are faked at their hook.
const insurancesMock = vi.hoisted(() => vi.fn<() => Promise<Insurance[]>>())
vi.mock('@/features/admin-insurances/api/insurances-api', () => ({
  listInsurances: insurancesMock,
  createInsurance: vi.fn(),
  updateInsurance: vi.fn(),
}))
const practicesMock = vi.hoisted(() => vi.fn<() => Promise<Practice[]>>())
vi.mock('@/features/admin-practices/api/practices-api', () => ({
  listPractices: practicesMock,
  createPractice: vi.fn(),
  updatePractice: vi.fn(),
  createLocation: vi.fn(),
  updateLocation: vi.fn(),
}))
const codesState = vi.hoisted(() => ({ ready: true, codes: [] as ProcedureCode[] }))
vi.mock('@/features/admin-procedure-codes/data/procedure-code-store', () => ({
  useProcedureCodes: () => ({ ...codesState, save: vi.fn() }),
}))

// Only the fields these screens read; the rest are irrelevant here.
const insurance = (id: number, practiceId: number, code: number, name: string) =>
  ({ id, practiceId, code, name }) as unknown as Insurance
const procedureCode = (code: string, description: string, defaultFee: number): ProcedureCode => ({
  code,
  description,
  procedureType: 'Therapeutic',
  isTimed: true,
  modifierOverride: false,
  modifiers: [],
  defaultFee,
  isActive: true,
  isNewFromEmr: false,
})
const year = new Date().getFullYear()
const thisYear = { from: `${year}-01-01`, to: `${year}-12-31` }

beforeEach(() => {
  insurancesMock
    .mockReset()
    .mockResolvedValue([
      insurance(1, 1, 1001, 'Medicare Part B'),
      insurance(3, 1, 1003, 'Aetna'),
      insurance(9, 2, 2001, 'Northgate Medicare'),
    ])
  practicesMock.mockReset().mockResolvedValue([])
  codesState.ready = true
  codesState.codes = [
    procedureCode('97110', 'Therapeutic exercise', 35),
    procedureCode('97140', 'Manual therapy techniques', 34),
    procedureCode('97530', 'Therapeutic activities', 40),
  ]
  resetFeeSchedules([
    { insuranceId: 1, procedureCode: '97110', billed: 30, ...thisYear },
    { insuranceId: 1, procedureCode: '97140', billed: 28, ...thisYear },
    { insuranceId: 3, procedureCode: '97110', billed: 38, ...thisYear },
  ])
})
afterEach(() => {
  useToastStore.getState().clear()
})

function renderAt(path = '/setup/fee-schedules') {
  const queryClient = createTestQueryClient()
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { queryClient },
  })
  renderWithProviders(<RouterProvider router={router} />, { queryClient })
  return { router }
}

const table = (name = 'Fee rows for Medicare Part B') =>
  screen.findByRole('table', { name }, { timeout: 5000 })

describe('Setup → Fee schedules', () => {
  it('shows the first insurance’s rows as the prototype does, under Setup, with no implementation notice', async () => {
    renderAt()
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Fee schedules' }, { timeout: 5000 }),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('navigation', { name: 'Setup' })).getByRole('link', { name: 'Fee schedules' }),
    ).toHaveAttribute('data-status', 'active')
    // How the data is held today is architecture, never product copy.
    expect(screen.queryByText(/not saved yet|not connected|browser tab|reloads/i)).not.toBeInTheDocument()
    const headers = within(await table())
      .getAllByRole('columnheader')
      .map((header) => header.textContent)
    expect(headers.slice(0, 4)).toEqual(['Code', 'Billed / unit', 'Default fee', 'Effective'])
    const rows = within(await table()).getAllByRole('row')
    expect(rows).toHaveLength(3)
    expect(rows[1]).toHaveTextContent('97110')
    expect(rows[1]).toHaveTextContent('Therapeutic exercise')
    expect(rows[1]).toHaveTextContent('$30.00')
    expect(rows[1]).toHaveTextContent('$35.00')
    expect(rows[1]).toHaveTextContent(`01/01/${year} – 12/31/${year}`)
    expect(screen.getByText('2 fee rows')).toBeInTheDocument()
  })

  it('shows another insurance’s rows from the URL, and an insurance without any', async () => {
    renderAt('/setup/fee-schedules?insurance=3')
    expect(within(await table('Fee rows for Aetna')).getAllByRole('row')).toHaveLength(2)
    renderAt('/setup/fee-schedules?insurance=9')
    expect(
      await screen.findByText('No fee schedule for Northgate Medicare', {}, { timeout: 5000 }),
    ).toBeInTheDocument()
    expect(screen.getByText('Every code falls back to its default fee.')).toBeInTheDocument()
  })

  it('adds a fee row for a code the insurance has no row for yet', async () => {
    renderAt()
    await table()
    await userEvent.click(screen.getByRole('button', { name: 'Add fee row' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Add fee row' })).toBeInTheDocument()
    expect(dialog).toHaveTextContent('Medicare Part B')
    await userEvent.clear(within(dialog).getByRole('textbox', { name: /effective from/i }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save fee row' }))
    expect(await within(dialog).findByText('Select a code.')).toBeInTheDocument()
    expect(within(dialog).getByText('Enter the billed price.')).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('combobox', { name: /^code/i }))
    // 97110 and 97140 already have rows for this insurance.
    expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual([
      '97530 — Therapeutic activities',
    ])
    await userEvent.click(screen.getByRole('option', { name: /97530/ }))
    const billed = within(dialog).getByRole('textbox', { name: /billed per unit/i })
    expect(billed).toHaveAttribute('placeholder', 'Enter billed price')
    await userEvent.type(billed, '36')
    await userEvent.type(within(dialog).getByRole('textbox', { name: /effective from/i }), `01/01/${year}`)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save fee row' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(within(await table()).getAllByRole('row')).toHaveLength(4)
    expect(within(await table()).getByText('97530')).toBeInTheDocument()
    expect(await screen.findByText('Fee row saved')).toBeInTheDocument()
  }, 20_000)

  it('edits a row with its values filled in and its code fixed', async () => {
    renderAt()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Edit the 97140 row' }, { timeout: 5000 }),
    )
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('combobox', { name: /^code/i })).toHaveAttribute('aria-disabled', 'true')
    const billed = within(dialog).getByRole('textbox', { name: /billed per unit/i })
    expect(billed).toHaveValue('28.00')
    await userEvent.clear(billed)
    await userEvent.type(billed, '29.5')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save fee row' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await table()).toHaveTextContent('$29.50')
  })

  it('deletes a row after confirming, and the code falls back to its default fee', async () => {
    renderAt()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Delete the 97110 row' }, { timeout: 5000 }),
    )
    const confirm = screen.getByRole('alertdialog')
    expect(confirm).toHaveTextContent('Delete the 97110 row?')
    expect(confirm).toHaveTextContent('The code falls back to its default fee for this payer.')
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete row' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(within(await table()).getAllByRole('row')).toHaveLength(2)
    // The lookup, on 97110 × 2, now prices from the default fee.
    const lookup = screen.getByRole('region', { name: 'Price lookup' })
    expect(lookup).toHaveTextContent('$70.00')
    expect(lookup).toHaveTextContent('Default fee · $35.00 × 2')
  })

  it('looks up a price: the payer’s row while in effect, otherwise the default fee', async () => {
    renderAt()
    await table()
    const lookup = screen.getByRole('region', { name: 'Price lookup' })
    expect(lookup).toHaveTextContent('$60.00')
    expect(lookup).toHaveTextContent('Medicare Part B schedule · $30.00 × 2')
    const units = within(lookup).getByRole('spinbutton', { name: 'Units' })
    await userEvent.clear(units)
    await userEvent.type(units, '3')
    expect(lookup).toHaveTextContent('$90.00')
    await userEvent.click(within(lookup).getByRole('combobox', { name: 'Code' }))
    await userEvent.click(await screen.findByRole('option', { name: /97530/ }))
    expect(lookup).toHaveTextContent('Default fee · $40.00 × 3')
    // A row only counts on the dates it is in effect.
    expect(todayIso() >= thisYear.from && todayIso() <= thisYear.to).toBe(true)
  })

  it('says what is needed before anything can be priced', async () => {
    codesState.codes = []
    renderAt()
    expect(await screen.findByText('Nothing to price yet', {}, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByText(/At least one procedure code/)).toHaveTextContent('still needed')
    expect(screen.getByRole('link', { name: 'Add a procedure code' })).toHaveAttribute(
      'href',
      '/setup/procedure-codes',
    )
    expect(screen.queryByRole('link', { name: 'Add an insurance' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add fee row' })).not.toBeInTheDocument()
  })

  it('shows a failed load of the insurances with a retry', async () => {
    insurancesMock.mockRejectedValueOnce(new ApiError({ kind: 'unavailable', message: 'Down.' }))
    renderAt()
    await userEvent.click(await screen.findByRole('button', { name: /try again/i }, { timeout: 5000 }))
    expect(await table()).toBeInTheDocument()
  })
})
