import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
import { ApiError } from '@/lib/api/api-error'
import { useToastStore } from '@/stores/toast-store'
import { createTestQueryClient, renderWithProviders } from '@/test/render'
import { useFeeSchedules } from '@/features/admin-fee-schedules'
import type { Insurance } from '@/features/admin-insurances'
import type { Practice } from '@/features/admin-practices'
import { useProcedureCodes } from '@/features/admin-procedure-codes'
import type { Provider } from '@/features/admin-providers'
import type { ReferringPhysician } from '@/features/admin-referring-physicians'
import { usePatientRecords } from '@/features/patients'
import { resetBillingExceptions } from '../data/exceptions-store'
import type { BillingException } from '../model/billing-exception'

// Exceptions are frontend only: their in-tab list starts from known records.
// The patients, procedure codes and fee schedules they fix are the
// development samples those features load in tests; the lists that come from
// an api are faked by path, never imported.
const practicesMock = vi.hoisted(() => vi.fn<() => Promise<Practice[]>>())
const insurancesMock = vi.hoisted(() => vi.fn<() => Promise<Insurance[]>>())
const providersMock = vi.hoisted(() => vi.fn<() => Promise<Provider[]>>())
const updateProviderMock = vi.hoisted(() => vi.fn())
const referrersMock = vi.hoisted(() => vi.fn<() => Promise<ReferringPhysician[]>>())
const updateReferrerMock = vi.hoisted(() => vi.fn())
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
vi.mock('@/features/admin-providers/api/providers-api', () => ({
  listProviders: providersMock,
  createProvider: vi.fn(),
  updateProvider: updateProviderMock,
}))
vi.mock('@/features/admin-referring-physicians/api/referring-physicians-api', () => ({
  listReferringPhysicians: referrersMock,
  createReferringPhysician: vi.fn(),
  updateReferringPhysician: updateReferrerMock,
}))

const practice = (id: number, name: string): Practice => ({
  id,
  organizationId: null,
  code: `P${id}`,
  name,
  dbaName: '',
  npi: '',
  taxId: '',
  taxonomyCode: '',
  address: { line1: '', line2: '', city: '', state: '', zip: '' },
  isActive: true,
  locations: [],
})
const aetna = { id: 3, practiceId: 1, name: 'Aetna' } as unknown as Insurance

const caleb: Provider = {
  id: 6,
  practiceId: 1,
  code: '327',
  firstName: 'Caleb',
  lastName: 'Wright',
  credential: 'PT',
  specialty: 'PHYSICAL THERAPIST',
  providerType: 'Billing',
  npi: '',
  taxonomyCode: '225100000X',
  stateLicense: 'NY 048115',
  claimHold: { from: null, until: null, reason: '', locationIds: [], insuranceIds: [] },
  isActive: true,
}

const referrers: ReferringPhysician[] = [
  { id: 1, practiceId: 1, code: 'PN01', name: 'Priya Natarajan, MD', type: 'DN', npi: '1720394851' },
  { id: 5, practiceId: 1, code: 'LV05', name: 'Leonard Voss, MD', type: 'DN', npi: '9999999999' },
]

/** One exception, open, on a session of the given sample patient. */
function exception(
  id: string,
  values: Partial<BillingException> & Pick<BillingException, 'level' | 'trigger' | 'fix'>,
): BillingException {
  return {
    id,
    practiceId: 1,
    detail: `${values.trigger} details.`,
    record: { kind: 'visit', patientId: 'p10', dos: '2026-09-14', recordId: `EMR-${id}` },
    status: 'Open',
    detectedAt: '2026-09-14T17:30',
    owner: null,
    due: '2099-09-17',
    resolvedAt: null,
    resolvedBy: null,
    ...values,
  }
}

const PHONE = exception('ex-phone', {
  level: 'Patient',
  trigger: 'Invalid patient phone number (dummy data)',
  detail: 'Phone 000-000-0000 is placeholder data.',
  fix: { type: 'patient-phone', patientId: 'p10' },
})
const ADDRESS = exception('ex-zip', {
  level: 'Patient',
  trigger: 'ZIP code mismatch with state',
  detail: 'ZIP 07030 belongs to NJ, but the state is NY.',
  record: { kind: 'visit', patientId: 'p11', dos: '2026-09-14', recordId: 'EMR-N-5590204' },
  fix: { type: 'patient-address', patientId: 'p11' },
})
const LENGTH = exception('ex-len', {
  level: 'Patient',
  trigger: 'Character limit exceeded',
  detail: 'Patient name is 41 characters (limit 30).',
  record: { kind: 'visit', patientId: 'p25', dos: '2026-09-14', recordId: 'EMR-N-5590208' },
  fix: { type: 'patient-length', patientId: 'p25' },
})
const REFERRER = exception('ex-ref', {
  level: 'Case',
  trigger: 'Invalid / dummy referring NPI',
  detail: 'Leonard Voss, MD carries NPI 9999999999.',
  record: { kind: 'visit', patientId: 'p12', dos: '2026-09-14', recordId: 'EMR-N-5590205' },
  fix: { type: 'referrer', referrerId: 5, caseId: 'p12-case' },
})
const NPI = exception('ex-npi', {
  level: 'Session',
  trigger: 'Missing mandatory rendering NPI',
  detail: 'Caleb Wright, PT has no NPI on file.',
  record: { kind: 'visit', patientId: 'p21', dos: '2026-09-14', recordId: 'EMR-N-5590207' },
  fix: { type: 'provider-npi', providerId: 6 },
})
const FEE = exception('ex-fee', {
  level: 'Charge',
  trigger: 'New CPT code charged at $0.00',
  detail: '97033 Iontophoresis is missing from the Aetna and default fee schedules.',
  record: { kind: 'visit', patientId: 'p14', dos: '2026-09-14', recordId: 'EMR-N-5590206' },
  fix: { type: 'fee', procedureCode: '97033', insuranceId: 3 },
  owner: 'Tomás Herrera',
  due: '2026-09-17',
})
const PAYMENT = exception('ex-pay', {
  level: 'Payment',
  trigger: 'Unmapped payer remittance data',
  detail: 'Claim control number HPT-26-099102 was not found — $26.82 unapplied.',
  record: { kind: 'era', control: '60054-835-260909', payerName: 'Aetna' },
  fix: { type: 'era-claim' },
  owner: 'Keisha Morgan',
  detectedAt: '2026-09-09T07:10',
})

beforeEach(() => {
  practicesMock
    .mockReset()
    .mockResolvedValue([practice(1, 'Harborline Physical Therapy'), practice(2, 'North Shore Rehab')])
  insurancesMock.mockReset().mockResolvedValue([aetna])
  providersMock.mockReset().mockResolvedValue([caleb])
  updateProviderMock.mockReset().mockImplementation((id: number) => Promise.resolve({ ...caleb, id }))
  referrersMock.mockReset().mockResolvedValue(referrers)
  updateReferrerMock.mockReset().mockImplementation((id: number) => Promise.resolve({ ...referrers[1], id }))
  resetBillingExceptions([LENGTH, NPI, FEE, REFERRER, ADDRESS, PHONE, PAYMENT])
})
afterEach(() => {
  useToastStore.getState().clear()
})

function renderAt(path: string) {
  const queryClient = createTestQueryClient()
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { queryClient },
  })
  renderWithProviders(<RouterProvider router={router} />, { queryClient })
  return router
}
const toasts = () => useToastStore.getState().toasts
const table = () => screen.findByRole('table', { name: 'Billing exceptions' }, { timeout: 5000 })
const rowOf = async (text: string) =>
  (await within(await table()).findByText(text, undefined, { timeout: 5000 })).closest('tr') as HTMLElement
const resolve = async (trigger: string) => {
  const row = await rowOf(trigger)
  await userEvent.click(
    within(row).getByRole('button', { name: new RegExp(`^Resolve ${trigger.replace(/[$()/.]/g, '\\$&')}`) }),
  )
  return screen.findByRole('dialog')
}

describe('Exceptions — the lists', () => {
  it('shows the open billing exceptions as the prototype does', async () => {
    renderAt('/exceptions')
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Exceptions' }, { timeout: 5000 }),
    ).toBeInTheDocument()
    const tabs = screen.getByRole('navigation', { name: 'Exception lists' })
    expect(within(tabs).getByRole('link', { name: 'Billing exceptions 7' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(within(tabs).getByRole('link', { name: 'Incomplete profiles 0' })).toBeInTheDocument()
    expect(within(tabs).getByRole('link', { name: 'Resolved 0' })).toBeInTheDocument()
    const pills = screen.getByRole('group', { name: 'Filter by level' })
    expect(
      within(pills)
        .getAllByRole('button')
        .map((pill) => pill.textContent),
    ).toEqual(['Patient 3', 'Case 1', 'Session 1', 'Charge 1', 'Payment 1'])

    // Newest first; the record is the patient's session, or the remittance.
    const rows = within(await table())
      .getAllByRole('row')
      .slice(1)
    expect(rows).toHaveLength(7)
    const fee = await rowOf('New CPT code charged at $0.00')
    expect(fee).toHaveTextContent('97033 Iontophoresis is missing from the Aetna and default fee schedules.')
    expect(await within(fee).findByText('Reilly, Thomas', undefined, { timeout: 5000 })).toBeInTheDocument()
    expect(fee).toHaveTextContent('DOS 09/14/2026 · record EMR-N-5590206')
    expect(fee).toHaveTextContent('Tomás Herrera')
    // Past its due date: marked, and said so.
    expect(within(fee).getByText('(overdue)', { exact: false })).toBeInTheDocument()
    expect(await rowOf('Missing mandatory rendering NPI')).toHaveTextContent('Unassigned')

    // Payment-level exceptions are fixed against claims and remittances: no Resolve here.
    const payment = await rowOf('Unmapped payer remittance data')
    expect(payment).toHaveTextContent('ERA 60054-835-260909')
    expect(payment).toHaveTextContent('Aetna')
    expect(within(payment).queryByRole('button', { name: /^Resolve/ })).not.toBeInTheDocument()
  }, 15_000)

  it('filters by level, and a link can open it on one level', async () => {
    renderAt('/exceptions')
    const pills = await screen.findByRole('group', { name: 'Filter by level' }, { timeout: 5000 })
    await userEvent.click(within(pills).getByRole('button', { name: 'Patient 3' }))
    expect(
      within(await table())
        .getAllByRole('row')
        .slice(1),
    ).toHaveLength(3)
    await userEvent.click(screen.getByRole('button', { name: 'Show all levels' }))
    expect(
      within(await table())
        .getAllByRole('row')
        .slice(1),
    ).toHaveLength(7)
  })

  it('opens on one level from a link (?level=Payment)', async () => {
    renderAt('/exceptions?level=Payment')
    const rows = within(await table())
      .getAllByRole('row')
      .slice(1)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toHaveTextContent('Unmapped payer remittance data')
    expect(screen.getByRole('button', { name: 'Payment 1' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('narrows to a practice (?practice=)', async () => {
    resetBillingExceptions([PHONE, { ...ADDRESS, practiceId: 2 }])
    renderAt('/exceptions?practice=2')
    const rows = within(await table())
      .getAllByRole('row')
      .slice(1)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toHaveTextContent('ZIP code mismatch with state')
  })

  it('says so when there is nothing to show', async () => {
    resetBillingExceptions([])
    const router = renderAt('/exceptions')
    expect(await screen.findByText('No open billing exceptions', undefined, { timeout: 5000 })).toBeVisible()
    await userEvent.click(screen.getByRole('link', { name: 'Resolved 0' }))
    expect(await screen.findByText('Nothing resolved yet')).toBeVisible()
    expect(router.state.location.pathname).toBe('/exceptions/resolved')
    await userEvent.click(screen.getByRole('link', { name: 'Incomplete profiles 0' }))
    expect(await screen.findByText('No incomplete profiles')).toBeVisible()
  })
})

describe('Exceptions — resolving', () => {
  it('fixes a placeholder phone: refuses another placeholder, then saves and resolves', async () => {
    renderAt('/exceptions')
    const dialog = await resolve('Invalid patient phone number (dummy data)')
    expect(within(dialog).getByRole('heading', { name: 'Fix phone — Victor Moreau' })).toBeInTheDocument()
    expect(
      within(dialog).getByText('Patient · Invalid patient phone number (dummy data).'),
    ).toBeInTheDocument()
    // The placeholder is not offered back.
    const cell = within(dialog).getByRole('textbox', { name: /cell phone/i })
    expect(cell).toHaveValue('')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save and re-check' }))
    expect(await within(dialog).findByText('Enter a phone number.')).toBeVisible()
    await userEvent.type(cell, '111-111-1111')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save and re-check' }))
    expect(await within(dialog).findByText('Please enter a valid phone number.')).toBeVisible()

    await userEvent.clear(cell)
    await userEvent.type(cell, '718-555-0177')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save and re-check' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(toasts()).toEqual([
      expect.objectContaining({ tone: 'success', title: 'Patient updated — exception resolved' }),
    ])
    expect(screen.getByRole('link', { name: 'Billing exceptions 6' })).toBeInTheDocument()
    expect(screen.queryByText('Invalid patient phone number (dummy data)')).not.toBeInTheDocument()

    // The patient record itself was corrected.
    const { result } = renderHook(() => usePatientRecords())
    expect(result.current.patients.find((patient) => patient.id === 'p10')?.phoneCell).toBe('718-555-0177')

    // And the exception is in Resolved.
    await userEvent.click(screen.getByRole('link', { name: 'Resolved 1' }))
    const resolved = await screen.findByRole('table', { name: 'Resolved exceptions' })
    expect(within(resolved).getByText('Invalid patient phone number (dummy data)')).toBeInTheDocument()
  }, 20_000)

  it('says when the same visit still has exceptions after a fix', async () => {
    resetBillingExceptions([
      PHONE,
      { ...ADDRESS, record: PHONE.record, fix: { type: 'patient-address', patientId: 'p10' } },
    ])
    renderAt('/exceptions')
    const dialog = await resolve('Invalid patient phone number (dummy data)')
    // The patients sample is shared by this file's tests: start from an empty field.
    const cell = within(dialog).getByRole('textbox', { name: /cell phone/i })
    await userEvent.clear(cell)
    await userEvent.type(cell, '718-555-0177')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save and re-check' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(toasts()).toEqual([
      expect.objectContaining({
        tone: 'warning',
        title: 'Patient updated — but the visit still has 1 exception',
        description: 'ZIP code mismatch with state',
      }),
    ])
  }, 15_000)

  it('fixes an address: the ZIP code must belong to the state', async () => {
    renderAt('/exceptions')
    const dialog = await resolve('ZIP code mismatch with state')
    expect(
      within(dialog).getByText('ZIP codes are cross-referenced against the state. 07030 belongs to NJ.'),
    ).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save and re-check' }))
    expect(await within(dialog).findByText('Please enter a valid ZIP code.')).toBeVisible()
    const zip = within(dialog).getByRole('textbox', { name: /^zip/i })
    await userEvent.clear(zip)
    await userEvent.type(zip, '11201')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save and re-check' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(toasts()).toEqual([expect.objectContaining({ title: 'Patient updated — exception resolved' })])
  }, 15_000)

  it('fixes a name that is too long, with the shortened version offered', async () => {
    renderAt('/exceptions')
    const dialog = await resolve('Character limit exceeded')
    await userEvent.click(
      within(dialog).getByRole('button', {
        name: 'Fill in a truncated version (name 30, address 35 characters)',
      }),
    )
    expect(within(dialog).getByRole('textbox', { name: /first name/i })).toHaveValue('Maximilian')
    expect(within(dialog).getByRole('textbox', { name: /middle name/i })).toHaveValue('')
    expect(toasts()).toEqual([expect.objectContaining({ tone: 'info', title: 'Truncated values filled in' })])
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save and re-check' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const { result } = renderHook(() => usePatientRecords())
    expect(result.current.patients.find((patient) => patient.id === 'p25')?.firstName).toBe('Maximilian')
  }, 15_000)

  it('corrects a dummy referring NPI on the directory profile', async () => {
    renderAt('/exceptions')
    const dialog = await resolve('Invalid / dummy referring NPI')
    expect(within(dialog).getByRole('radio', { name: /Correct Leonard Voss, MD’s NPI/ })).toBeChecked()
    const npi = within(dialog).getByRole('textbox', { name: /correct npi/i })
    await userEvent.type(npi, '1234567890')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save and re-check' }))
    expect(await within(dialog).findByText('Please enter a valid NPI.')).toBeVisible()
    await userEvent.clear(npi)
    await userEvent.type(npi, '1609873452')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save and re-check' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(updateReferrerMock).toHaveBeenCalledWith(5, {
      practiceId: '1',
      code: 'LV05',
      name: 'Leonard Voss, MD',
      type: 'DN',
      npi: '1609873452',
    })
    expect(toasts()).toEqual([
      expect.objectContaining({ title: 'Referring physician fixed — exception resolved' }),
    ])
  }, 15_000)

  it('or gives the case another referring physician', async () => {
    renderAt('/exceptions')
    const dialog = await resolve('Invalid / dummy referring NPI')
    await userEvent.click(
      within(dialog).getByRole('radio', { name: 'Use a different referring physician on this case' }),
    )
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save and re-check' }))
    expect(await within(dialog).findByText('Select the referring physician.')).toBeVisible()
    await userEvent.click(within(dialog).getByRole('combobox', { name: /^referring physician/i }))
    await userEvent.click(await screen.findByRole('option', { name: 'Priya Natarajan, MD' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save and re-check' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(updateReferrerMock).not.toHaveBeenCalled()
    const { result } = renderHook(() => usePatientRecords())
    expect(result.current.cases.find((item) => item.id === 'p12-case')?.referrerId).toBe(1)
  }, 15_000)

  it('adds the rendering NPI on the provider — and keeps the dialog open if the save fails', async () => {
    updateProviderMock.mockRejectedValueOnce(new ApiError({ kind: 'network', message: 'offline' }))
    renderAt('/exceptions')
    const dialog = await resolve('Missing mandatory rendering NPI')
    expect(
      within(dialog).getByRole('heading', { name: 'Add rendering NPI — Caleb Wright, PT' }),
    ).toBeInTheDocument()
    await userEvent.type(within(dialog).getByRole('textbox', { name: /individual npi/i }), '1528461903')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save and re-check' }))
    expect(
      await within(dialog).findByText('Could not reach the server. Check your connection and try again.'),
    ).toBeVisible()
    // Nothing was resolved. (The page behind an open dialog is hidden from the accessibility tree.)
    expect(screen.getByRole('link', { name: 'Billing exceptions 7', hidden: true })).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Save and re-check' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(updateProviderMock).toHaveBeenLastCalledWith(
      6,
      expect.objectContaining({ npi: '1528461903', firstName: 'Caleb' }),
    )
    expect(toasts()).toEqual([expect.objectContaining({ title: 'Provider NPI saved — exception resolved' })])
  }, 15_000)

  it('prices a code charged at $0.00: a default fee, the payer’s rate, or both', async () => {
    renderAt('/exceptions')
    const dialog = await resolve('New CPT code charged at $0.00')
    expect(within(dialog).getByRole('heading', { name: 'Price 97033 — Iontophoresis' })).toBeInTheDocument()
    // Why the default fee matters is behind its info icon, not under the field.
    expect(
      within(dialog).getByRole('button', { name: 'About Default fee per unit' }),
    ).toHaveAccessibleDescription('Used when no payer row matches.')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save and re-check' }))
    expect(await within(dialog).findByText('Enter the default fee.')).toBeVisible()

    await userEvent.type(within(dialog).getByRole('textbox', { name: /default fee per unit/i }), '18.50')
    await userEvent.type(within(dialog).getByRole('textbox', { name: /billed per unit/i }), '22')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save and re-check' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(toasts()).toEqual([expect.objectContaining({ title: '97033 priced — exception resolved' })])

    const codes = renderHook(() => useProcedureCodes()).result.current
    expect(codes.codes.find((code) => code.code === '97033')?.defaultFee).toBe(18.5)
    const fees = renderHook(() => useFeeSchedules()).result.current
    expect(fees.rows.find((row) => row.insuranceId === 3 && row.procedureCode === '97033')).toEqual(
      expect.objectContaining({ billed: 22 }),
    )
  }, 20_000)

  it('completes a missing case field, and a subscriber’s details', async () => {
    resetBillingExceptions([
      exception('ex-case', {
        level: 'Case',
        trigger: 'Missing mandatory EMR case fields',
        detail: 'Employment status is missing.',
        fix: { type: 'case', caseId: 'p10-case', field: 'employmentStatus' },
      }),
      exception('ex-sub', {
        level: 'Case',
        trigger: 'Missing subscriber details',
        detail: 'Primary insurance subscriber details are incomplete.',
        record: { kind: 'visit', patientId: 'p10', dos: '2026-09-15', recordId: 'EMR-other' },
        fix: { type: 'coverage', coverageId: 'p10-cov-1' },
      }),
    ])
    renderAt('/exceptions')
    let dialog = await resolve('Missing mandatory EMR case fields')
    expect(
      within(dialog).getByRole('heading', { name: 'Complete case fields — Plantar fasciitis' }),
    ).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save and re-check' }))
    expect(await within(dialog).findByText('Enter the employment status.')).toBeVisible()
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: /employment status/i }),
      'Employed full time',
    )
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save and re-check' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(toasts()).toEqual([expect.objectContaining({ title: 'Case updated — exception resolved' })])

    dialog = await resolve('Missing subscriber details')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save and re-check' }))
    expect(await within(dialog).findByText('Enter the subscriber’s name.')).toBeVisible()
    await userEvent.type(within(dialog).getByRole('textbox', { name: /subscriber name/i }), 'Claire Moreau')
    await userEvent.type(within(dialog).getByRole('textbox', { name: /subscriber dob/i }), '03/02/1974')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save and re-check' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const { result } = renderHook(() => usePatientRecords())
    expect(result.current.cases.find((item) => item.id === 'p10-case')?.employmentStatus).toBe(
      'Employed full time',
    )
    expect(result.current.coverages.find((item) => item.id === 'p10-cov-1')?.subscriber).toEqual(
      expect.objectContaining({ name: 'Claire Moreau', dob: '1974-03-02' }),
    )
  }, 25_000)
})
