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
  deleteInsuranceClass,
  getInsuranceClass,
  listInsuranceClasses,
  setInsuranceClassActive,
  updateInsuranceClass,
} from '../api/insurance-classes-api'
import { listInsurances } from '../api/insurances-api'
import type { Insurance } from '../schemas/insurance'
import type { InsuranceClass } from '../schemas/insurance-class'
import { insurance, insuranceClass, practice } from './test-fixtures'

// Only the integration points are faked; everything above them runs for real.
vi.mock('../api/insurance-classes-api', () => ({
  listInsuranceClasses: vi.fn(),
  getInsuranceClass: vi.fn(),
  createInsuranceClass: vi.fn(),
  updateInsuranceClass: vi.fn(),
  setInsuranceClassActive: vi.fn(),
  deleteInsuranceClass: vi.fn(),
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
const getMock = vi.mocked(getInsuranceClass)
const setActiveMock = vi.mocked(setInsuranceClassActive)
const deleteMock = vi.mocked(deleteInsuranceClass)
const insurancesMock = vi.mocked(listInsurances)

let classes: InsuranceClass[]
let insurances: Insurance[]

beforeEach(() => {
  classes = [
    insuranceClass(1, 1, 'WC', 'Worker’s Comp', {
      authorization_required: true,
      injury_date_required: true,
      insurances_count: 1,
    }),
    insuranceClass(2, 1, 'COM', 'Commercial', { accept_assignment: false, insurances_count: 2 }),
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
  getMock.mockReset().mockImplementation((id) => {
    const found = classes.find((item) => item.id === id)
    return found
      ? Promise.resolve(structuredClone(found))
      : Promise.reject(new ApiError({ kind: 'not_found', message: 'Not found', status: 404 }))
  })
  // As the backend answers: its own message, no record.
  createMock.mockReset().mockResolvedValue('Insurance class created successfully')
  updateMock.mockReset().mockResolvedValue('Insurance class updated successfully')
  setActiveMock.mockReset().mockImplementation((id, isActive) => {
    classes = classes.map((item) => (item.id === id ? { ...item, isActive } : item))
    return Promise.resolve('Insurance class updated successfully')
  })
  deleteMock.mockReset().mockImplementation((id) => {
    classes = classes.filter((item) => item.id !== id)
    return Promise.resolve('Insurance class deleted successfully')
  })
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

  it('lists classes in the server’s order with their rule defaults, insurance counts and status', async () => {
    renderAt()
    const rows = within(await table()).getAllByRole('row')
    const commercial = within(rows[2] as HTMLElement)
    expect(commercial.getByText('Commercial')).toBeInTheDocument()
    expect(commercial.getByText('No assignment')).toBeInTheDocument()
    // Two insurances, as the class counts them.
    const cells = within(rows[2] as HTMLElement).getAllByRole('cell')
    expect(cells.map((cell) => cell.textContent)).toContain('2')
    // Only what the backend sends: no "With overrides" count.
    expect(
      within(await table())
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).not.toContain('With overrides')
    const comp = within(rows[1] as HTMLElement)
    expect(comp.getByText('Auth required')).toBeInTheDocument()
    expect(comp.getByText('Injury date required')).toBeInTheDocument()
    expect(within(rows[3] as HTMLElement).getByRole('switch', { name: /: active$/ })).not.toBeChecked()
  })

  it('changes a class’s status from its row with the Active switch, after asking, changing only is_active', async () => {
    renderAt()
    const rows = within(await table()).getAllByRole('row')
    await userEvent.click(within(rows[3] as HTMLElement).getByRole('switch', { name: /: active$/ }))
    expect(setActiveMock).not.toHaveBeenCalled()
    // Asks first.
    await userEvent.click(
      within(await screen.findByRole('alertdialog', { name: /^(Deactivate|Reactivate) / })).getByRole(
        'button',
        {
          name: /^(Deactivate|Reactivate)$/,
        },
      ),
    )
    await waitFor(() => expect(setActiveMock).toHaveBeenCalledWith(3, true))
    expect(updateMock).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(within(rows[3] as HTMLElement).getByRole('switch', { name: /: active$/ })).toBeChecked()
    expect(useToastStore.getState().toasts).toEqual([
      expect.objectContaining({ tone: 'success', title: 'Insurance class updated successfully' }),
    ])
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

  it('edits a class: says how many insurances it has, keeps the practice fixed, deactivates from the form', async () => {
    renderAt()
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Commercial' }))
    const dialog = screen.getByRole('dialog')
    await within(dialog).findByRole('textbox', { name: /^code/i })
    expect(getMock).toHaveBeenCalledWith(2, expect.anything())
    expect(within(dialog).getByText('2 insurances are in this class.')).toBeInTheDocument()
    expect(within(dialog).getByRole('combobox', { name: /^practice/i })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    await userEvent.click(within(dialog).getByRole('switch', { name: 'Active' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save class' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(updateMock).toHaveBeenCalledWith(2, expect.objectContaining({ code: 'COM', isActive: false }))
  })

  it('deletes a class after asking, saying how many insurances it has', async () => {
    renderAt()
    await userEvent.click(await screen.findByRole('button', { name: 'Delete Commercial' }, { timeout: 5000 }))
    const ask = await screen.findByRole('alertdialog', { name: 'Delete Commercial?' })
    expect(ask).toHaveTextContent('2 insurances are in this class.')
    await userEvent.click(within(ask).getByRole('button', { name: 'Delete class' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(deleteMock).toHaveBeenCalledWith(2)
    expect(screen.getByRole('status')).toHaveTextContent('Insurance class deleted successfully')
    await waitFor(async () => expect(within(await table()).queryByText('Commercial')).not.toBeInTheDocument())
  })

  it('says why when a delete is refused', async () => {
    deleteMock.mockRejectedValueOnce(
      new ApiError({
        kind: 'validation',
        message: 'This class still has insurances.',
        serverMessage: 'This class still has insurances.',
        status: 422,
      }),
    )
    renderAt()
    await userEvent.click(await screen.findByRole('button', { name: 'Delete Commercial' }, { timeout: 5000 }))
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete class' }),
    )
    await waitFor(() =>
      expect(useToastStore.getState().toasts).toEqual([
        expect.objectContaining({
          tone: 'error',
          title: 'Commercial was not deleted',
          description: 'This class still has insurances.',
        }),
      ]),
    )
  })
})
