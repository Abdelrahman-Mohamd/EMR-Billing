import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
import { useToastStore } from '@/stores/toast-store'
import { createTestQueryClient, renderWithProviders } from '@/test/render'
import type { Insurance, InsuranceClass } from '@/features/admin-insurances'
import type { Practice } from '@/features/admin-practices'
import type { ReferringPhysician } from '@/features/admin-referring-physicians'
import { resetPatientRecords } from '../data/patient-records-store'
import {
  coverage,
  insurance,
  insuranceClass,
  patient,
  patientCase,
  practice,
  referrer,
} from './test-fixtures'

// Patients are frontend only: their in-tab store starts from known records.
// The practices, insurances, classes and referring physicians are other
// features' integration points: faked by path, never imported.
const practicesMock = vi.hoisted(() => vi.fn<() => Promise<Practice[]>>())
const insurancesMock = vi.hoisted(() => vi.fn<() => Promise<Insurance[]>>())
const classesMock = vi.hoisted(() => vi.fn<() => Promise<InsuranceClass[]>>())
const referrersMock = vi.hoisted(() => vi.fn<() => Promise<ReferringPhysician[]>>())
vi.mock('@/features/admin-practices/api/practices-api', () => ({
  listPractices: practicesMock,
  createPractice: vi.fn(),
  updatePractice: vi.fn(),
  createLocation: vi.fn(),
  updateLocation: vi.fn(),
}))
vi.mock('@/features/admin-insurances/api/insurances-api', () => ({
  listInsurances: insurancesMock,
  createInsurance: vi.fn(),
  updateInsurance: vi.fn(),
}))
vi.mock('@/features/admin-insurances/api/insurance-classes-api', () => ({
  listInsuranceClasses: classesMock,
  createInsuranceClass: vi.fn(),
  updateInsuranceClass: vi.fn(),
}))
vi.mock('@/features/admin-referring-physicians/api/referring-physicians-api', () => ({
  listReferringPhysicians: referrersMock,
  createReferringPhysician: vi.fn(),
  updateReferringPhysician: vi.fn(),
}))

beforeEach(() => {
  practicesMock
    .mockReset()
    .mockResolvedValue([practice(1, 'Harborline Physical Therapy'), practice(2, 'Northgate')])
  insurancesMock
    .mockReset()
    .mockResolvedValue([
      insurance(1, 'Medicare Part B'),
      insurance(3, 'Aetna'),
      insurance(9, 'Northgate Medicare', { practiceId: 2 }),
    ])
  classesMock.mockReset().mockResolvedValue([insuranceClass(1, 'Medicare')])
  referrersMock.mockReset().mockResolvedValue([referrer(1, 'Priya Natarajan, MD')])
  resetPatientRecords({
    patients: [
      patient({ id: 'p1', firstName: 'Nadia', lastName: 'Okonkwo', billingId: 10412, emrId: 56361773 }),
      patient({
        id: 'p2',
        firstName: 'Harold',
        lastName: 'Brennan',
        billingId: 10413,
        emrId: 56361904,
        dob: '1951-02-03',
      }),
      patient({
        id: 'p3',
        firstName: 'Grace',
        lastName: 'Holloway',
        billingId: 10420,
        emrId: 56362821,
        isActive: false,
      }),
      patient({
        id: 'p4',
        practiceId: 2,
        firstName: 'Isabella',
        lastName: 'Marino',
        billingId: 10424,
        emrId: 56363345,
      }),
    ],
    coverages: [
      coverage({ id: 'cv1', patientId: 'p1', insuranceId: 3 }),
      coverage({ id: 'cv2', patientId: 'p2', insuranceId: 1 }),
      coverage({ id: 'cv4', patientId: 'p4', insuranceId: 9 }),
    ],
    cases: [
      patientCase({ id: 'c1', patientId: 'p1', name: 'R shoulder 2026', primaryCoverageId: 'cv1' }),
      patientCase({ id: 'c2', patientId: 'p2', name: 'L knee TKA rehab', primaryCoverageId: 'cv2' }),
      patientCase({ id: 'c2b', patientId: 'p2', name: 'Gait', primaryCoverageId: 'cv2' }),
      patientCase({ id: 'c4', patientId: 'p4', name: 'L hip OA', primaryCoverageId: 'cv4' }),
    ],
  })
})
afterEach(() => {
  useToastStore.getState().clear()
})

function renderAt(path = '/patients') {
  const queryClient = createTestQueryClient()
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { queryClient },
  })
  renderWithProviders(<RouterProvider router={router} />, { queryClient })
  return router
}

const table = () => screen.findByRole('table', { name: 'Patients' }, { timeout: 5000 })
const names = async () =>
  within(await table())
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0]?.textContent?.split('Billing ID')[0]?.trim())
const rowOf = async (text: string) =>
  within(await table())
    .getAllByRole('row')
    .find((row) => row.textContent?.includes(text)) as HTMLElement

describe('Patients — the roster', () => {
  it('lists the active patients as the prototype does, under the Patients rail entry', async () => {
    renderAt()
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Patients' }, { timeout: 5000 }),
    ).toBeInTheDocument()
    expect(await names()).toEqual(['Brennan, Harold', 'Marino, Isabella', 'Okonkwo, Nadia'])
    const okonkwo = await rowOf('Okonkwo')
    expect(okonkwo).toHaveTextContent('Billing ID 10412')
    expect(okonkwo).toHaveTextContent('06/12/1984')
    expect(okonkwo).toHaveTextContent('56361773')
    expect(okonkwo).toHaveTextContent('Aetna')
    expect(within(await rowOf('Brennan')).getAllByRole('cell')[3]).toHaveTextContent('2')
    expect(within(okonkwo).getByRole('switch', { name: 'Okonkwo, Nadia: active' })).toBeChecked()
    expect(screen.getByText('3 patients')).toBeInTheDocument()
    // Not part of this build: balances, which need billed charges.
    expect(screen.queryByText(/open balance/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/backend|not saved|temporary|demo|coming soon|mock/i)).not.toBeInTheDocument()
  })

  it('searches by name in either order, Billing ID or EMR ID — and the search never reaches the URL', async () => {
    const router = renderAt()
    await table()
    const search = screen.getByRole('searchbox', { name: 'Search by name, Billing ID or EMR ID' })
    await userEvent.type(search, 'okonkwo, nad')
    expect(await names()).toEqual(['Okonkwo, Nadia'])
    await userEvent.clear(search)
    await userEvent.type(search, '10413')
    expect(await names()).toEqual(['Brennan, Harold'])
    await userEvent.clear(search)
    await userEvent.type(search, '56363345')
    expect(await names()).toEqual(['Marino, Isabella'])
    expect(router.state.location.search).toEqual({})

    await userEvent.clear(search)
    await userEvent.type(search, 'nobody')
    expect(await screen.findByText('No patients match')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Clear search and filters' }))
    expect(await names()).toHaveLength(3)
  })

  it('filters by practice, kept in the URL', async () => {
    const router = renderAt()
    await table()
    await userEvent.click(screen.getByRole('combobox', { name: 'Filter by practice' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Northgate' }))
    expect(await names()).toEqual(['Marino, Isabella'])
    expect(router.state.location.search).toEqual({ practice: 2 })
  })

  it('filters by primary insurance and status in the drawer', async () => {
    renderAt('/patients?practice=1')
    await table()
    await userEvent.click(screen.getByRole('button', { name: /^Filters/ }))
    const drawer = screen.getByRole('dialog', { name: 'Filter patients' })
    expect(within(drawer).getByText('Filters apply when you press Search.')).toBeVisible()
    await userEvent.click(within(drawer).getByRole('combobox', { name: 'Status' }))
    await userEvent.click(screen.getByRole('option', { name: 'Inactive' }))
    await userEvent.click(within(drawer).getByRole('button', { name: 'Search' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await names()).toEqual(['Holloway, Grace'])
    // The Filters button says how many filters are on.
    expect(screen.getByRole('button', { name: 'Filters, 1 on' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /^Filters/ }))
    const again = screen.getByRole('dialog', { name: 'Filter patients' })
    await userEvent.click(within(again).getByRole('button', { name: 'Reset' }))
    await userEvent.click(within(again).getByRole('combobox', { name: 'Primary insurance' }))
    await userEvent.click(screen.getByRole('option', { name: 'Aetna' }))
    await userEvent.click(within(again).getByRole('button', { name: 'Search' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await names()).toEqual(['Okonkwo, Nadia'])
  })

  it('deactivates a patient from the roster after a confirmation', async () => {
    renderAt()
    const toggle = within(await rowOf('Okonkwo')).getByRole('switch', { name: 'Okonkwo, Nadia: active' })
    await userEvent.click(toggle)
    const confirm = screen.getByRole('alertdialog', { name: 'Deactivate this patient?' })
    expect(
      within(confirm).getByText(
        'The patient is hidden from the active roster. Existing claims and balances are kept.',
      ),
    ).toBeVisible()
    await userEvent.click(within(confirm).getByRole('button', { name: 'Deactivate' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    // Hidden from the active roster.
    expect(await names()).toEqual(['Brennan, Harold', 'Marino, Isabella'])
    expect(useToastStore.getState().toasts).toEqual([
      expect.objectContaining({ title: 'Patient deactivated' }),
    ])
  })

  it('opens a patient’s chart from the roster', async () => {
    const router = renderAt()
    await userEvent.click(within(await rowOf('Okonkwo')).getByRole('link'))
    expect(await screen.findByRole('heading', { level: 3, name: 'Demographics' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/patients/p1')
  })
})

describe('Patients — New patient', () => {
  async function openNew() {
    renderAt('/patients?practice=1')
    await table()
    await userEvent.click(screen.getByRole('button', { name: 'New patient' }))
    return screen.getByRole('dialog', { name: 'New patient' })
  }
  const box = (dialog: HTMLElement, name: RegExp) => within(dialog).getByRole('textbox', { name })

  it('asks for what billing needs, in the prototype’s formats', async () => {
    const dialog = await openNew()
    expect(within(dialog).getByRole('combobox', { name: /practice/i })).toHaveTextContent(
      'Harborline Physical Therapy',
    )
    expect(box(dialog, /^state/i)).toHaveValue('NY')
    expect(within(dialog).getByText(/A “Default” case is created with the patient/)).toBeVisible()
    // The guarantor's own fields wait for "Another person".
    expect(within(dialog).queryByRole('textbox', { name: /guarantor name/i })).not.toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Create patient' }))
    for (const message of [
      'Enter the first name.',
      'Enter the last name.',
      'Enter the date of birth.',
      'Select a gender.',
      'Enter the street address.',
      'Enter the city.',
      'Enter the ZIP code.',
    ])
      expect(await within(dialog).findByText(message)).toBeVisible()

    await userEvent.type(box(dialog, /^ssn/i), '12345')
    await userEvent.type(box(dialog, /cell phone/i), '7185550100')
    await userEvent.type(box(dialog, /email/i), 'nope')
    await userEvent.type(box(dialog, /^zip/i), '112')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create patient' }))
    expect(await within(dialog).findByText('Please enter a valid SSN.')).toBeVisible()
    expect(within(dialog).getByText('Please enter a valid phone number.')).toBeVisible()
    expect(within(dialog).getByText('Please enter a valid email address.')).toBeVisible()
    expect(within(dialog).getByText('Please enter a valid ZIP code.')).toBeVisible()
  })

  it('asks for the guarantor and their address when another person receives the statements', async () => {
    const dialog = await openNew()
    await userEvent.click(within(dialog).getByRole('combobox', { name: /who receives statements/i }))
    await userEvent.click(screen.getByRole('option', { name: 'Another person' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create patient' }))
    for (const message of [
      'Enter the guarantor’s name.',
      'Select the relationship.',
      'Enter the guarantor’s address.',
    ])
      expect(await within(dialog).findByText(message)).toBeVisible()
  })

  it('creates the patient with a Default case and opens their insurance', async () => {
    const router = renderAt('/patients?practice=1')
    await table()
    await userEvent.click(screen.getByRole('button', { name: 'New patient' }))
    const dialog = screen.getByRole('dialog', { name: 'New patient' })
    await userEvent.type(box(dialog, /first name/i), 'Ada')
    await userEvent.type(box(dialog, /last name/i), 'Lin')
    await userEvent.type(box(dialog, /date of birth/i), '04/02/1990')
    await userEvent.click(within(dialog).getByRole('combobox', { name: /gender/i }))
    await userEvent.click(screen.getByRole('option', { name: 'Female' }))
    await userEvent.type(box(dialog, /street address/i), '1 Court Street')
    await userEvent.type(box(dialog, /^city/i), 'Brooklyn')
    await userEvent.type(box(dialog, /^zip/i), '11201')
    await userEvent.click(within(dialog).getByRole('combobox', { name: /who receives statements/i }))
    await userEvent.click(screen.getByRole('option', { name: 'Another person' }))
    await userEvent.type(box(dialog, /guarantor name/i), 'Wen Lin')
    await userEvent.click(within(dialog).getByRole('combobox', { name: /relationship/i }))
    await userEvent.click(screen.getByRole('option', { name: 'Parent' }))
    await userEvent.type(box(dialog, /guarantor address/i), '9 Hicks Street')
    const cities = within(dialog).getAllByRole('textbox', { name: /^city/i })
    await userEvent.type(cities.at(-1) as HTMLElement, 'Brooklyn')
    const states = within(dialog).getAllByRole('textbox', { name: /^state/i })
    await userEvent.type(states.at(-1) as HTMLElement, 'ny')
    const zips = within(dialog).getAllByRole('textbox', { name: /^zip/i })
    await userEvent.type(zips.at(-1) as HTMLElement, '11201')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create patient' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByRole('heading', { level: 2, name: 'Insurance coverage' })).toBeInTheDocument()
    // The chart, opened at the patient's insurance.
    expect(router.state.location.pathname).toMatch(/^\/patients\/patient-\d+$/)
    expect(router.state.location.hash).toBe('insurance')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Lin Ada')
    expect(useToastStore.getState().toasts).toEqual([
      expect.objectContaining({
        title: 'Patient created',
        description:
          'A “Default” case was added. Add the patient’s insurance, then choose it on the case with its diagnoses before the first charge.',
      }),
    ])

    // The same page holds the guarantor with their address, and the Default case.
    expect(await screen.findByText('Wen Lin (Parent)')).toBeVisible()
    expect(screen.getByText('9 Hicks Street, Brooklyn, NY 11201')).toBeVisible()
    expect(screen.getByRole('heading', { level: 2, name: /^Case: Default/ })).toBeInTheDocument()
  }, 20_000) // A long form typed key by key.
})
