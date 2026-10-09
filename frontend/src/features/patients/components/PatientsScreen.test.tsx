import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
import { ApiError } from '@/lib/api/api-error'
import { useToastStore } from '@/stores/toast-store'
import { createTestQueryClient, renderWithProviders } from '@/test/render'
import type { Insurance, InsuranceClass } from '@/features/admin-insurances'
import type { Practice } from '@/features/admin-practices'
import type { ReferringPhysician } from '@/features/admin-referring-physicians'
import { createPatient, getPatient, listPatients, setPatientActive, updatePatient } from '../api/patients-api'
import { resetPatientRecords } from '../data/patient-records-store'
import type { Patient } from '../model/patient'
import { insurance, insuranceClass, patient, practice, referrer } from './test-fixtures'

// Only the integration points are faked: this feature's api functions,
// answering as the server does, and the other features' lists — by path,
// never imported. Everything above them runs for real.
vi.mock('../api/patients-api', () => ({
  listPatients: vi.fn(),
  getPatient: vi.fn(),
  createPatient: vi.fn(),
  updatePatient: vi.fn(),
  updatePatientFields: vi.fn(),
  setPatientActive: vi.fn(),
  deletePatient: vi.fn(),
}))
// Their cases too: the chart reads them.
vi.mock('../api/patient-cases-api', () => ({ listPatientCases: () => Promise.resolve([]) }))
const listMock = vi.mocked(listPatients)
const getMock = vi.mocked(getPatient)
const createMock = vi.mocked(createPatient)
const updateMock = vi.mocked(updatePatient)
const setActiveMock = vi.mocked(setPatientActive)

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

let patients: Patient[]

beforeEach(() => {
  practicesMock
    .mockReset()
    .mockResolvedValue([practice(1, 'Harborline Physical Therapy'), practice(2, 'Northgate')])
  insurancesMock.mockReset().mockResolvedValue([insurance(3, 'Aetna')])
  classesMock.mockReset().mockResolvedValue([insuranceClass(1, 'Medicare')])
  referrersMock.mockReset().mockResolvedValue([referrer(1, 'Priya Natarajan, MD')])
  patients = [
    patient({
      id: '10412',
      firstName: 'Nadia',
      lastName: 'Okonkwo',
      emrId: 56361773,
      cases: [{ id: '1', name: 'Default', isActive: true }],
    }),
    patient({
      id: '10413',
      firstName: 'Harold',
      lastName: 'Brennan',
      emrId: 56361904,
      dob: '1951-02-03',
      gender: 'M',
      genderLabel: 'Male',
    }),
    patient({ id: '10420', firstName: 'Grace', lastName: 'Holloway', emrId: 56362821, isActive: false }),
    patient({ id: '10424', practiceId: 2, firstName: 'Isabella', lastName: 'Marino', emrId: 56363345 }),
  ]
  listMock.mockReset().mockImplementation(() => Promise.resolve(structuredClone(patients)))
  getMock.mockReset().mockImplementation((id) => {
    const found = patients.find((item) => item.id === id)
    return found
      ? Promise.resolve(structuredClone(found))
      : Promise.reject(new ApiError({ kind: 'not_found', message: 'Not found', status: 404 }))
  })
  createMock.mockReset().mockResolvedValue('Patient created successfully')
  updateMock.mockReset().mockResolvedValue('Patient updated successfully')
  setActiveMock.mockReset().mockImplementation((id, isActive) => {
    patients = patients.map((item) => (item.id === id ? { ...item, isActive } : item))
    return Promise.resolve('Patient updated successfully')
  })
  resetPatientRecords({})
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
  it('lists the active patients as the list carries them, under the Patients rail entry', async () => {
    renderAt()
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Patients' }, { timeout: 5000 }),
    ).toBeInTheDocument()
    expect(await names()).toEqual(['Brennan, Harold', 'Marino, Isabella', 'Okonkwo, Nadia'])
    const headers = within(await table())
      .getAllByRole('columnheader')
      .map((header) => header.textContent)
    // The prototype's Cases and Primary insurance are not in the patient list.
    expect(headers.slice(0, 4)).toEqual(['Patient', 'Born', 'EMR ID', 'Active'])
    const okonkwo = await rowOf('Okonkwo')
    expect(okonkwo).toHaveTextContent('Billing ID 10412')
    expect(okonkwo).toHaveTextContent('06/12/1984')
    expect(okonkwo).toHaveTextContent('Female')
    expect(okonkwo).toHaveTextContent('56361773')
    expect(within(okonkwo).getByRole('switch', { name: 'Okonkwo, Nadia: active' })).toBeChecked()
    expect(screen.getByText('3 patients')).toBeInTheDocument()
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

  it('filters by status in the drawer', async () => {
    renderAt('/patients?practice=1')
    await table()
    await userEvent.click(screen.getByRole('button', { name: /^Filters/ }))
    const drawer = screen.getByRole('dialog', { name: 'Filter patients' })
    expect(within(drawer).getByText('Filters apply when you press Search.')).toBeVisible()
    // Primary insurance is not in the patient list, so it is not a filter.
    expect(within(drawer).queryByRole('combobox', { name: 'Primary insurance' })).not.toBeInTheDocument()
    await userEvent.click(within(drawer).getByRole('combobox', { name: 'Status' }))
    await userEvent.click(screen.getByRole('option', { name: 'Inactive' }))
    await userEvent.click(within(drawer).getByRole('button', { name: 'Search' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await names()).toEqual(['Holloway, Grace'])
    expect(screen.getByRole('button', { name: 'Filters, 1 on' })).toBeInTheDocument()
  })

  it('shows a failed load with a retry', async () => {
    listMock.mockRejectedValueOnce(new ApiError({ kind: 'unavailable', message: 'Down.' }))
    renderAt()
    await userEvent.click(await screen.findByRole('button', { name: /try again/i }, { timeout: 5000 }))
    expect(await names()).toHaveLength(3)
  })

  it('deactivates a patient from the roster after a confirmation, with the server’s message', async () => {
    renderAt()
    const toggle = within(await rowOf('Okonkwo')).getByRole('switch', { name: 'Okonkwo, Nadia: active' })
    await userEvent.click(toggle)
    const confirm = screen.getByRole('alertdialog', { name: 'Deactivate this patient?' })
    expect(
      within(confirm).getByText(
        'The patient is hidden from the active roster. Existing claims and balances are kept.',
      ),
    ).toBeVisible()
    expect(setActiveMock).not.toHaveBeenCalled()
    await userEvent.click(within(confirm).getByRole('button', { name: 'Deactivate' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(setActiveMock).toHaveBeenCalledWith('10412', false)
    // Hidden from the active roster.
    expect(await names()).toEqual(['Brennan, Harold', 'Marino, Isabella'])
    expect(useToastStore.getState().toasts).toEqual([
      expect.objectContaining({ title: 'Patient updated successfully' }),
    ])
  })

  it('opens a patient’s chart from the roster', async () => {
    const router = renderAt()
    await userEvent.click(within(await rowOf('Okonkwo')).getByRole('link'))
    expect(await screen.findByRole('heading', { level: 3, name: 'Demographics' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/patients/10412')
    expect(getMock).toHaveBeenCalledWith('10412', expect.anything())
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

  it('asks for what the server needs, in its formats', async () => {
    const dialog = await openNew()
    expect(within(dialog).getByRole('combobox', { name: /practice/i })).toHaveTextContent(
      'Harborline Physical Therapy',
    )
    expect(box(dialog, /^state/i)).toHaveValue('NY')
    expect(box(dialog, /middle name/i)).toHaveAttribute('placeholder', 'Enter middle name')
    expect(within(dialog).getByText(/A “Default” case is created with the patient/)).toBeVisible()
    // Statements are sent unless switched off.
    expect(within(dialog).getByRole('switch', { name: 'Don’t send statements' })).not.toBeChecked()
    // The guarantor's own fields wait for "Another person".
    expect(within(dialog).queryByRole('combobox', { name: /relationship/i })).not.toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('combobox', { name: /gender/i }))
    expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual([
      'Female',
      'Male',
      'Unknown',
    ])
    await userEvent.keyboard('{Escape}')

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

    await userEvent.type(box(dialog, /emr id/i), '12a')
    await userEvent.type(box(dialog, /^ssn/i), '12345')
    await userEvent.type(box(dialog, /cell phone/i), '718555')
    await userEvent.type(box(dialog, /email/i), 'nope')
    await userEvent.type(box(dialog, /^zip/i), '112')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create patient' }))
    expect(await within(dialog).findByText('Please enter a valid EMR ID.')).toBeVisible()
    expect(within(dialog).getByText('Please enter a valid SSN.')).toBeVisible()
    expect(within(dialog).getByText('Please enter a valid phone number.')).toBeVisible()
    expect(within(dialog).getByText('Please enter a valid email address.')).toBeVisible()
    expect(within(dialog).getByText('Please enter a valid ZIP code.')).toBeVisible()
    expect(createMock).not.toHaveBeenCalled()
  }, 20_000)

  it('asks for the guarantor’s name and relationship — and an address only once begun', async () => {
    const dialog = await openNew()
    await userEvent.click(within(dialog).getByRole('combobox', { name: /who receives statements/i }))
    await userEvent.click(screen.getByRole('option', { name: 'Another person' }))
    await userEvent.click(within(dialog).getByRole('combobox', { name: /relationship/i }))
    expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual([
      'Spouse',
      'Parent',
      'Legal Guardian',
      'Other',
    ])
    await userEvent.keyboard('{Escape}')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create patient' }))
    for (const message of [
      'Enter the guarantor’s first name.',
      'Enter the guarantor’s last name.',
      'Select the relationship.',
    ])
      expect(await within(dialog).findByText(message)).toBeVisible()
    expect(within(dialog).queryByText('Enter the guarantor’s address.')).not.toBeInTheDocument()

    await userEvent.type(box(dialog, /guarantor address/i), '9 Hicks Street')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create patient' }))
    expect(await within(dialog).findAllByText('Enter the city.')).not.toHaveLength(0)
  }, 15_000)

  it('creates the patient on the server, shows its message and stays on the roster', async () => {
    const router = renderAt('/patients?practice=1')
    await table()
    await userEvent.click(screen.getByRole('button', { name: 'New patient' }))
    const dialog = screen.getByRole('dialog', { name: 'New patient' })
    await userEvent.type(box(dialog, /emr id/i), '56361649')
    await userEvent.type(box(dialog, /first name/i), 'Ada')
    await userEvent.type(box(dialog, /last name/i), 'Lin')
    await userEvent.type(box(dialog, /date of birth/i), '04/02/1990')
    await userEvent.click(within(dialog).getByRole('combobox', { name: /gender/i }))
    await userEvent.click(screen.getByRole('option', { name: 'Female' }))
    await userEvent.type(box(dialog, /^ssn/i), '123-45-6789')
    await userEvent.type(box(dialog, /cell phone/i), '(718) 555-0142')
    await userEvent.type(box(dialog, /street address/i), '1 Court Street')
    await userEvent.type(box(dialog, /^city/i), 'Brooklyn')
    await userEvent.type(box(dialog, /^zip/i), '11201')
    await userEvent.click(within(dialog).getByRole('combobox', { name: /who receives statements/i }))
    await userEvent.click(screen.getByRole('option', { name: 'Another person' }))
    await userEvent.click(within(dialog).getByRole('combobox', { name: /relationship/i }))
    await userEvent.click(screen.getByRole('option', { name: 'Parent' }))
    const firsts = within(dialog).getAllByRole('textbox', { name: /^first name/i })
    await userEvent.type(firsts.at(-1) as HTMLElement, 'Wen')
    const lasts = within(dialog).getAllByRole('textbox', { name: /^last name/i })
    await userEvent.type(lasts.at(-1) as HTMLElement, 'Lin')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create patient' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        practiceId: '1',
        emrId: '56361649',
        firstName: 'Ada',
        gender: 'F',
        ssn: '123-45-6789',
        phoneCell: '(718) 555-0142',
        guarantorType: 'other',
        guarantorFirstName: 'Wen',
        guarantorRelationship: 'Parent',
        guarantorLine1: '',
      }),
    )
    // The server returns no id, so the roster stays, read again.
    expect(router.state.location.pathname).toBe('/patients')
    expect(await screen.findByText('Patient created successfully')).toBeInTheDocument()
  }, 30_000) // A long form typed key by key.

  it('keeps the dialog and puts the server’s field error on the field', async () => {
    createMock.mockRejectedValueOnce(
      new ApiError({
        kind: 'validation',
        message: 'The SSN is not a valid Social Security number.',
        fieldErrors: [{ path: 'ssn', message: 'The SSN is not a valid Social Security number.' }],
      }),
    )
    const dialog = await openNew()
    await userEvent.type(box(dialog, /first name/i), 'Ada')
    await userEvent.type(box(dialog, /last name/i), 'Lin')
    await userEvent.type(box(dialog, /date of birth/i), '04/02/1990')
    await userEvent.click(within(dialog).getByRole('combobox', { name: /gender/i }))
    await userEvent.click(screen.getByRole('option', { name: 'Female' }))
    await userEvent.type(box(dialog, /^ssn/i), '987-65-4321')
    await userEvent.type(box(dialog, /street address/i), '1 Court Street')
    await userEvent.type(box(dialog, /^city/i), 'Brooklyn')
    await userEvent.type(box(dialog, /^zip/i), '11201')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create patient' }))
    expect(await within(dialog).findByText('The SSN is not a valid Social Security number.')).toBeVisible()
    expect(screen.getByRole('dialog', { name: 'New patient' })).toBeInTheDocument()
  }, 20_000)
})
