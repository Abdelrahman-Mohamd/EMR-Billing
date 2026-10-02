import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
import { ApiError } from '@/lib/api/api-error'
import { useToastStore } from '@/stores/toast-store'
import { createTestQueryClient, renderWithProviders } from '@/test/render'
import type { Practice } from '@/features/admin-practices'
import {
  createInsuranceClass,
  listInsuranceClasses,
  updateInsuranceClass,
} from '../api/insurance-classes-api'
import { listInsurances } from '../api/insurances-api'
import type { Insurance } from '../schemas/insurance'
import type { InsuranceClass } from '../schemas/insurance-class'
import { insurance, insuranceClass, practice } from './test-fixtures'

// Only the integration points are faked; everything above them runs for real.
vi.mock('../api/insurance-classes-api', () => ({
  listInsuranceClasses: vi.fn(),
  createInsuranceClass: vi.fn(),
  updateInsuranceClass: vi.fn(),
}))
vi.mock('../api/insurances-api', () => ({
  listInsurances: vi.fn(),
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

const listMock = vi.mocked(listInsuranceClasses)
const createMock = vi.mocked(createInsuranceClass)
const updateMock = vi.mocked(updateInsuranceClass)
const insurancesMock = vi.mocked(listInsurances)

let classes: InsuranceClass[]
let insurances: Insurance[]

beforeEach(() => {
  classes = [
    insuranceClass(1, 1, 'WC', 'Worker’s Comp', { authorization_required: true, injury_date_required: true }),
    insuranceClass(2, 1, 'COM', 'Commercial', { accept_assignment: false }),
    insuranceClass(3, 2, 'MED', 'Medicare', { is_active: false }),
  ]
  insurances = [
    insurance(1, 1, 2, 1003, 'Aetna'),
    insurance(2, 1, 2, 1004, 'UnitedHealthcare', { authorization_required: true }),
    insurance(3, 1, 1, 1039, 'Corvel Enterprise'),
  ]
  listMock.mockReset().mockImplementation(() => Promise.resolve(structuredClone(classes)))
  insurancesMock.mockReset().mockImplementation(() => Promise.resolve(structuredClone(insurances)))
  practicesMock
    .mockReset()
    .mockResolvedValue([practice(1, 'Harborline Physical Therapy'), practice(2, 'Northgate Sports & Spine')])
  createMock.mockReset().mockImplementation(() => Promise.resolve(classes[0] as InsuranceClass))
  updateMock.mockReset().mockImplementation(() => Promise.resolve(classes[0] as InsuranceClass))
})
afterEach(() => {
  useToastStore.getState().clear()
})

function renderAt(path = '/setup/insurance-classes') {
  const queryClient = createTestQueryClient()
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { queryClient },
  })
  renderWithProviders(<RouterProvider router={router} />, { queryClient })
  return { router }
}

const table = () => screen.findByRole('table', { name: 'Insurance classes' })

describe('Setup → Insurance classes', () => {
  it('is a Setup section, beside Admin rather than inside it', async () => {
    renderAt()
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Insurance classes' }, { timeout: 5000 }),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('navigation', { name: 'Setup' })).getByRole('link', {
        name: 'Insurance classes',
      }),
    ).toHaveAttribute('data-status', 'active')
    expect(screen.queryByRole('navigation', { name: 'Admin' })).not.toBeInTheDocument()
  })

  it('lists classes by code with their rule defaults, insurance counts and status', async () => {
    renderAt()
    const rows = within(await table()).getAllByRole('row')
    const commercial = within(rows[1] as HTMLElement)
    expect(commercial.getByText('Commercial')).toBeInTheDocument()
    expect(commercial.getByText('No assignment')).toBeInTheDocument()
    // Two insurances, one of which overrides a rule.
    const cells = within(rows[1] as HTMLElement).getAllByRole('cell')
    expect(cells.map((cell) => cell.textContent)).toContain('2')
    expect(cells.map((cell) => cell.textContent)).toContain('1')
    const comp = within(rows[3] as HTMLElement)
    expect(comp.getByText('Auth required')).toBeInTheDocument()
    expect(comp.getByText('Injury date required')).toBeInTheDocument()
    expect(within(rows[2] as HTMLElement).getByRole('switch', { name: /: active$/ })).not.toBeChecked()
  })

  it('changes a class’s status from its row with the Active switch, changing only is_active', async () => {
    renderAt()
    const rows = within(await table()).getAllByRole('row')
    await userEvent.click(within(rows[2] as HTMLElement).getByRole('switch', { name: /: active$/ }))
    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1))
    const [, values] = updateMock.mock.calls[0] ?? []
    expect(values).toEqual(expect.objectContaining({ isActive: true }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('shows a loading state, then a failed load with a retry', async () => {
    listMock.mockRejectedValueOnce(new ApiError({ kind: 'unavailable', message: 'Down.' }))
    renderAt()
    expect(await screen.findByRole('status')).toHaveTextContent('Loading')
    await userEvent.click(await screen.findByRole('button', { name: /try again/i }))
    expect(within(await table()).getByText('Commercial')).toBeInTheDocument()
  })

  it('refuses an incomplete class', async () => {
    renderAt()
    await userEvent.click(await screen.findByRole('button', { name: 'New class' }))
    const dialog = screen.getByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save class' }))
    for (const message of ['Select a practice.', 'Enter the class code.', 'Enter the class name.']) {
      expect(await within(dialog).findByText(message)).toBeInTheDocument()
    }
    expect(createMock).not.toHaveBeenCalled()
  })

  it('adds a class with its rule defaults set by switches', async () => {
    renderAt('/setup/insurance-classes?practice=1')
    await userEvent.click(await screen.findByRole('button', { name: 'New class' }))
    const dialog = screen.getByRole('dialog')
    await userEvent.type(within(dialog).getByRole('textbox', { name: /^code/i }), 'hmo')
    expect(within(dialog).getByRole('textbox', { name: /^code/i })).toHaveValue('HMO')
    await userEvent.type(within(dialog).getByRole('textbox', { name: /^name/i }), 'HMO plans')
    // The prototype's defaults: specialty modifiers and assignment on, the rest off.
    expect(within(dialog).getByRole('switch', { name: 'Apply specialty modifiers' })).toBeChecked()
    expect(within(dialog).getByRole('switch', { name: 'Authorization required' })).not.toBeChecked()
    await userEvent.click(within(dialog).getByRole('switch', { name: 'Authorization required' }))
    expect(within(dialog).getByRole('button', { name: 'About Authorization required' })).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save class' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(createMock).toHaveBeenCalledWith({
      practiceId: '1',
      code: 'HMO',
      name: 'HMO plans',
      authorizationRequired: true,
      injuryDateRequired: false,
      applySpecialtyModifiers: true,
      acceptAssignment: true,
      icdVersion: 'ICD10',
      isActive: true,
    })
  })

  it('edits a class: names its insurances, keeps the practice fixed, deactivates from the form', async () => {
    renderAt()
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Commercial' }))
    const dialog = screen.getByRole('dialog')
    expect(
      within(dialog).getByText(
        '2 insurances in this class: 1003 – Aetna, 1004 – UnitedHealthcare (overrides).',
      ),
    ).toBeInTheDocument()
    expect(within(dialog).getByRole('combobox', { name: /^practice/i })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    await userEvent.click(within(dialog).getByRole('switch', { name: 'Active' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save class' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(updateMock).toHaveBeenCalledWith(2, expect.objectContaining({ code: 'COM', isActive: false }))
  })
})
