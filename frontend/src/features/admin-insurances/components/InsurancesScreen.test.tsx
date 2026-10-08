import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
import { ApiError } from '@/lib/api/api-error'
import { useToastStore } from '@/stores/toast-store'
import { createTestQueryClient, renderWithProviders } from '@/test/render'
import type { Practice } from '@/features/admin-practices'
import type { ReleaseBucket } from '@/features/admin-release-buckets'
import { listInsuranceClasses } from '../api/insurance-classes-api'
import {
  createInsurance,
  deleteInsurance,
  getInsurance,
  listInsurances,
  setInsuranceActive,
  updateInsurance,
} from '../api/insurances-api'
import type { Insurance, InsuranceDetail } from '../schemas/insurance'
import type { InsuranceClass } from '../schemas/insurance-class'
import { bucket, insurance, insuranceClass, insuranceDetail, practice } from './test-fixtures'

// Only the integration points are faked; everything above them runs for real.
vi.mock('../api/insurances-api', () => ({
  listInsurances: vi.fn(),
  getInsurance: vi.fn(),
  createInsurance: vi.fn(),
  updateInsurance: vi.fn(),
  setInsuranceActive: vi.fn(),
  deleteInsurance: vi.fn(),
}))
vi.mock('../api/insurance-classes-api', () => ({
  listInsuranceClasses: vi.fn(),
  getInsuranceClass: vi.fn(),
  createInsuranceClass: vi.fn(),
  updateInsuranceClass: vi.fn(),
  setInsuranceClassActive: vi.fn(),
  deleteInsuranceClass: vi.fn(),
}))
// Other features' internals: faked by path, never imported (lint forbids it).
const practicesMock = vi.hoisted(() => vi.fn<() => Promise<Practice[]>>())
vi.mock('@/features/admin-practices/api/practices-api', () => ({
  listPractices: practicesMock,
  createPractice: vi.fn(),
  updatePractice: vi.fn(),
  createLocation: vi.fn(),
  updateLocation: vi.fn(),
}))
const bucketsMock = vi.hoisted(() => vi.fn<() => Promise<ReleaseBucket[]>>())
vi.mock('@/features/admin-release-buckets/api/release-buckets-api', () => ({
  listReleaseBuckets: bucketsMock,
  createReleaseBucket: vi.fn(),
  updateReleaseBucket: vi.fn(),
}))
const listMock = vi.mocked(listInsurances)
const getMock = vi.mocked(getInsurance)
const createMock = vi.mocked(createInsurance)
const updateMock = vi.mocked(updateInsurance)
const setActiveMock = vi.mocked(setInsuranceActive)
const deleteMock = vi.mocked(deleteInsurance)
const classesMock = vi.mocked(listInsuranceClasses)

const SECRET = 'P0rtal-S3cret'

let classes: InsuranceClass[]
let insurances: Insurance[]
let details: Map<number, InsuranceDetail>

beforeEach(() => {
  classes = [
    insuranceClass(1, 1, 'MED', 'Medicare', { authorization_required: true }),
    insuranceClass(3, 1, 'COM', 'Commercial'),
    insuranceClass(4, 1, 'OLD', 'Retired class', { is_active: false }),
    insuranceClass(7, 2, 'MED', 'Northgate Medicare'),
  ]
  insurances = [
    insurance(1, 1, 1, 1001, 'Medicare Part B', {
      insurance_type: 'MB',
      insurance_type_label: 'Medicare Part B',
      insurance_class: { id: 1, name: 'Medicare' },
      payer_id: '13202',
    }),
    insurance(2, 1, 3, 1039, 'Corvel Enterprise', {
      insurance_type: 'WC',
      insurance_type_label: "Workers' Comp",
      insurance_class: { id: 3, name: 'Commercial' },
      audit_required: true,
      insurance_hold: true,
      release_bucket: { id: 1, name: 'Manual Release – WC Payers' },
      authorization_required: false,
    }),
    insurance(3, 2, 7, 2001, 'Northgate Medicare Part B', {
      insurance_class: { id: 7, name: 'Northgate Medicare' },
      is_active: false,
    }),
  ]
  details = new Map(
    insurances.map((item) => [
      item.id,
      insuranceDetail(
        item,
        item.id === 1 ? { portal_url: 'https://portal.example-medicare.gov', phone: '8005550199' } : {},
      ),
    ]),
  )
  listMock.mockReset().mockImplementation(() => Promise.resolve(structuredClone(insurances)))
  getMock.mockReset().mockImplementation((id) => {
    const found = details.get(id)
    return found
      ? Promise.resolve(structuredClone(found))
      : Promise.reject(new ApiError({ kind: 'not_found', message: 'Not found', status: 404 }))
  })
  classesMock.mockReset().mockImplementation(() => Promise.resolve(structuredClone(classes)))
  practicesMock
    .mockReset()
    .mockResolvedValue([practice(1, 'Harborline Physical Therapy'), practice(2, 'Northgate Sports & Spine')])
  bucketsMock
    .mockReset()
    .mockResolvedValue([
      bucket(1, 1, 'Manual Release – WC Payers'),
      bucket(2, 1, 'Manual Release – Auto / No-Fault'),
      { ...bucket(3, 1, 'Manual Release – Paused'), isActive: false },
      bucket(4, 2, 'Manual Release – Northgate'),
    ])
  // As the backend answers: its own message, no record.
  createMock.mockReset().mockResolvedValue('Insurance created successfully')
  updateMock.mockReset().mockResolvedValue('Insurance updated successfully')
  setActiveMock.mockReset().mockImplementation((id, isActive) => {
    insurances = insurances.map((item) => (item.id === id ? { ...item, isActive } : item))
    return Promise.resolve('Insurance updated successfully')
  })
  deleteMock.mockReset().mockImplementation((id) => {
    insurances = insurances.filter((item) => item.id !== id)
    return Promise.resolve('Insurance deleted successfully')
  })
})
afterEach(() => {
  useToastStore.getState().clear()
})

function renderAt(path = '/setup/insurances') {
  const queryClient = createTestQueryClient()
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { queryClient },
  })
  renderWithProviders(<RouterProvider router={router} />, { queryClient })
  return { router }
}

const table = () => screen.findByRole('table', { name: 'Insurances' }, { timeout: 5000 })

async function openNew() {
  await userEvent.click(await screen.findByRole('button', { name: 'New insurance' }, { timeout: 5000 }))
  return screen.getByRole('dialog')
}

async function openEdit(label: string) {
  await userEvent.click(await screen.findByRole('button', { name: `Edit ${label}` }, { timeout: 5000 }))
  const dialog = screen.getByRole('dialog')
  await within(dialog).findByRole('textbox', { name: /^code/i })
  return dialog
}

async function choose(dialog: HTMLElement, combobox: RegExp, option: RegExp) {
  const control = within(dialog).getByRole('combobox', { name: combobox })
  await waitFor(() => expect(control).not.toHaveAttribute('aria-disabled', 'true'))
  await userEvent.click(control)
  await userEvent.click(await screen.findByRole('option', { name: option }))
}

const optionNames = async (dialog: HTMLElement, combobox: RegExp) => {
  await userEvent.click(within(dialog).getByRole('combobox', { name: combobox }))
  const names = (await screen.findAllByRole('option')).map((option) => option.textContent)
  await userEvent.keyboard('{Escape}')
  return names
}

describe('Setup → Insurances', () => {
  it('lists every payer with its class and type, practice, payer ID, rules, hold, audit and status', async () => {
    renderAt()
    // The first test pays for loading the route's code-split chunk.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Insurances' }, { timeout: 5000 }),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('navigation', { name: 'Setup' })).getByRole('link', { name: 'Insurances' }),
    ).toHaveAttribute('data-status', 'active')
    // Only what the list endpoint carries: no portal link, no SLA.
    expect(
      within(await table())
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Payer', 'Payer ID', 'Effective billing rules', 'Insurance hold', 'Active', 'Actions'])
    const rows = within(await table()).getAllByRole('row')
    const medicare = within(rows[1] as HTMLElement)
    expect(medicare.getByText('1001 – Medicare Part B')).toBeInTheDocument()
    // The class and the type, as the server words them.
    expect(rows[1]).toHaveTextContent('Medicare · Medicare Part B')
    expect(rows[1]).toHaveTextContent('Harborline Physical Therapy')
    expect(medicare.getByText('13202')).toBeInTheDocument()
    // Auth required comes from the class (COALESCE).
    expect(medicare.getByText('Auth required')).toBeInTheDocument()
    expect(medicare.queryByRole('link')).not.toBeInTheDocument()
    expect(medicare.getByRole('switch', { name: /: active$/ })).toBeChecked()

    const corvel = within(rows[2] as HTMLElement)
    expect(rows[2]).toHaveTextContent("Commercial · Workers' Comp")
    expect(corvel.getByText('Manual release')).toBeInTheDocument()
    expect(corvel.getByText('Manual Release – WC Payers')).toBeInTheDocument()
    expect(corvel.getAllByText('Audit required').length).toBeGreaterThan(0)
    expect(corvel.getByText('· overrides class')).toBeInTheDocument()
    expect(within(rows[3] as HTMLElement).getByRole('switch', { name: /: active$/ })).not.toBeChecked()
  })

  it('keeps each row as it is when the list is filtered to one practice', async () => {
    renderAt('/setup/insurances?practice=2')
    const rows = within(await table()).getAllByRole('row')
    expect(rows).toHaveLength(2)
    expect(within(rows[1] as HTMLElement).getByText('2001 – Northgate Medicare Part B')).toBeInTheDocument()
    // The practice is still named: the row keeps its height when filtered.
    expect(rows[1]).toHaveTextContent('Northgate Sports & Spine')
  })

  it('deactivates an insurance from its row with the Active switch, after asking, changing only is_active', async () => {
    renderAt()
    const rows = within(await table()).getAllByRole('row')
    const toggle = within(rows[1] as HTMLElement).getByRole('switch', { name: /: active$/ })
    await userEvent.click(toggle)
    expect(setActiveMock).not.toHaveBeenCalled()
    await userEvent.click(
      within(
        await screen.findByRole('alertdialog', { name: 'Deactivate 1001 – Medicare Part B?' }),
      ).getByRole('button', { name: 'Deactivate' }),
    )
    await waitFor(() => expect(setActiveMock).toHaveBeenCalledWith(1, false))
    expect(updateMock).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(toggle).not.toBeChecked()
    expect(screen.getByRole('status')).toHaveTextContent('Insurance updated successfully')
  })

  it('shows a loading state, then a failed load with a retry', async () => {
    listMock.mockRejectedValueOnce(new ApiError({ kind: 'unavailable', message: 'Down.' }))
    renderAt()
    expect(await screen.findByRole('status', {}, { timeout: 5000 })).toHaveTextContent('Loading')
    await userEvent.click(await screen.findByRole('button', { name: /try again/i }))
    expect(within(await table()).getByText('1001 – Medicare Part B')).toBeInTheDocument()
  })

  it('explains an empty list and offers to add the first insurance', async () => {
    insurances = []
    renderAt()
    expect(await screen.findByText('No insurances yet', {}, { timeout: 5000 })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Add an insurance' }))
    expect(
      within(screen.getByRole('dialog')).getByRole('heading', { name: 'New insurance' }),
    ).toBeInTheDocument()
  })

  it('refuses an incomplete insurance with a message on each field', async () => {
    renderAt('/setup/insurances?practice=1')
    const dialog = await openNew()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save insurance' }))
    for (const message of [
      'Enter the insurance code.',
      'Enter the insurance name.',
      'Select an insurance class.',
      'Select an insurance type.',
    ]) {
      expect(await within(dialog).findByText(message)).toBeInTheDocument()
    }
    expect(createMock).not.toHaveBeenCalled()
  })

  it('adds an insurance with its class, type, audit flag, portal link and portal sign-in', async () => {
    renderAt('/setup/insurances?practice=1')
    const dialog = await openNew()
    // The practice comes from the filter; only its active classes are offered.
    expect(await optionNames(dialog, /insurance class/i)).toEqual(['MED — Medicare', 'COM — Commercial'])
    // The server's type codes, with its labels.
    expect(await optionNames(dialog, /insurance type/i)).toEqual([
      'Commercial',
      'Medicare Part B',
      'Medicaid',
      'Blue Cross / Blue Shield',
      'HMO',
      "Workers' Comp",
      'Auto / PIP',
      'Tricare',
      'Veterans Affairs',
      'Other Federal',
      'Other',
    ])
    await userEvent.type(within(dialog).getByRole('textbox', { name: /^code/i }), '1060')
    await userEvent.type(within(dialog).getByRole('textbox', { name: /^name/i }), 'Oscar Health')
    await choose(dialog, /insurance class/i, /COM — Commercial/)
    await choose(dialog, /insurance type/i, /^Commercial$/)
    await userEvent.type(within(dialog).getByRole('textbox', { name: /payer id/i }), 'OSCAR')
    await userEvent.type(within(dialog).getByRole('textbox', { name: /^suite/i }), 'Suite 9')
    await userEvent.type(within(dialog).getByRole('textbox', { name: /^phone/i }), '(800) 555-0199')
    const portal = within(dialog).getByRole('textbox', { name: /payer portal link/i })
    expect(portal).toHaveAttribute('placeholder', 'Enter payer portal URL')
    await userEvent.type(portal, 'https://portal.example-payer.com')
    await userEvent.type(within(dialog).getByRole('textbox', { name: /^portal user/i }), 'billing@clinic')
    const password = within(dialog).getByLabelText(/^portal password/i)
    expect(password).toHaveAttribute('type', 'password')
    expect(password).toHaveAttribute('autocomplete', 'new-password')
    await userEvent.type(password, SECRET)
    await userEvent.click(within(dialog).getByRole('switch', { name: 'Audit required' }))

    await userEvent.click(within(dialog).getByRole('button', { name: 'Save insurance' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        practiceId: '1',
        code: '1060',
        name: 'Oscar Health',
        insuranceClassId: '3',
        insuranceType: 'CI',
        payerId: 'OSCAR',
        address: expect.objectContaining({ line2: 'Suite 9' }) as unknown,
        phone: '(800) 555-0199',
        portalUrl: 'https://portal.example-payer.com',
        portalUser: 'billing@clinic',
        portalPassword: SECRET,
        auditRequired: true,
        insuranceHold: false,
        authorizationRequired: 'inherit',
        isActive: true,
      }),
    )
    expect(await screen.findByText('Insurance created successfully')).toBeInTheDocument()
    expect(document.body).not.toHaveTextContent(SECRET)
  }, 20_000)

  it('asks for an active release bucket of the practice only while the insurance hold is on', async () => {
    renderAt('/setup/insurances?practice=1')
    const dialog = await openNew()
    expect(within(dialog).queryByRole('combobox', { name: /release bucket/i })).not.toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('switch', { name: 'Insurance hold' }))
    // Only this practice's active buckets are offered.
    expect(await optionNames(dialog, /release bucket/i)).toEqual([
      'Manual Release – WC Payers',
      'Manual Release – Auto / No-Fault',
    ])
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save insurance' }))
    expect(await within(dialog).findByText('Select a release bucket.')).toBeInTheDocument()
  })

  it('shows each rule’s effective value, from the class or overridden', async () => {
    renderAt()
    const dialog = await openEdit('1001 – Medicare Part B')
    const panel = within(dialog).getByRole('region', { name: 'Effective values' })
    const authRow = () => within(panel).getByText('Authorization required').parentElement as HTMLElement
    expect(authRow()).toHaveTextContent(/Yes\s*from the class/)
    await choose(dialog, /^authorization required/i, /No — override/)
    expect(authRow()).toHaveTextContent(/No\s*overridden/)
  })

  it('edits an insurance from its full record: practice fixed, portal sign-in empty, Active switched off', async () => {
    renderAt()
    const dialog = await openEdit('1001 – Medicare Part B')
    expect(getMock).toHaveBeenCalledWith(1, expect.anything())
    expect(within(dialog).getByRole('heading', { name: '1001 – Medicare Part B' })).toBeInTheDocument()
    expect(within(dialog).getByRole('combobox', { name: /^practice/i })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    // From the record, not the list: the portal link, and the phone shown readably.
    expect(within(dialog).getByRole('textbox', { name: /payer portal link/i })).toHaveValue(
      'https://portal.example-medicare.gov',
    )
    expect(within(dialog).getByRole('textbox', { name: /^phone/i })).toHaveValue('800-555-0199')
    // The portal sign-in is never returned: empty, and kept unless a new one is typed.
    expect(within(dialog).getByRole('textbox', { name: /^portal user/i })).toHaveValue('')
    expect(within(dialog).getByLabelText(/^portal password/i)).toHaveValue('')
    expect(within(dialog).getByRole('button', { name: 'About Portal password' })).toHaveAccessibleDescription(
      'Never shown once saved. Leave it empty to keep the current one.',
    )
    await userEvent.click(within(dialog).getByRole('switch', { name: 'Active' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save insurance' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(updateMock).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ isActive: false, code: '1001', portalUser: '', portalPassword: '' }),
    )
    expect(screen.getByRole('status')).toHaveTextContent('Insurance updated successfully')
  })

  it('puts a server’s field error back on the field', async () => {
    updateMock.mockRejectedValueOnce(
      new ApiError({
        kind: 'validation',
        message: 'The code has already been taken.',
        serverMessage: 'The code has already been taken.',
        status: 422,
        fieldErrors: [{ path: 'code', message: 'The code has already been taken.' }],
      }),
    )
    renderAt()
    await openEdit('1001 – Medicare Part B')
    await userEvent.click(screen.getByRole('button', { name: 'Save insurance' }))
    expect(await screen.findByText('The code has already been taken.')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('points to Insurance classes when the practice has no active class', async () => {
    classes = classes.filter((record) => record.practiceId !== 2)
    renderAt('/setup/insurances?practice=2')
    const dialog = await openNew()
    const link = await within(dialog).findByRole('link', { name: 'Create an insurance class' })
    expect(link).toHaveAttribute('href', '/setup/insurance-classes?practice=2')
  })

  it('deletes an insurance after asking, and says why when the server refuses', async () => {
    renderAt()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Delete 1039 – Corvel Enterprise' }, { timeout: 5000 }),
    )
    await userEvent.click(
      within(await screen.findByRole('alertdialog', { name: 'Delete 1039 – Corvel Enterprise?' })).getByRole(
        'button',
        { name: 'Delete insurance' },
      ),
    )
    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith(2))
    expect(await screen.findByText('Insurance deleted successfully')).toBeInTheDocument()
    await waitFor(async () =>
      expect(within(await table()).queryByText('1039 – Corvel Enterprise')).not.toBeInTheDocument(),
    )

    deleteMock.mockRejectedValueOnce(
      new ApiError({
        kind: 'validation',
        message: 'This insurance is used by patients.',
        serverMessage: 'This insurance is used by patients.',
        status: 422,
      }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Delete 1001 – Medicare Part B' }))
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete insurance' }),
    )
    await waitFor(() =>
      expect(useToastStore.getState().toasts.at(-1)).toEqual(
        expect.objectContaining({
          tone: 'error',
          title: '1001 – Medicare Part B was not deleted',
          description: 'This insurance is used by patients.',
        }),
      ),
    )
  }, 15_000)

  it('starts a new insurance at EDI 837P, and saves it without a payer ID — the server does not need one', async () => {
    renderAt('/setup/insurances?practice=1')
    const dialog = await openNew()
    expect(within(dialog).getByRole('combobox', { name: /^claim format/i })).toHaveTextContent('EDI 837P')
    await userEvent.type(within(dialog).getByRole('textbox', { name: /^code/i }), '1061')
    await userEvent.type(within(dialog).getByRole('textbox', { name: /^name/i }), 'Plain Payer')
    await choose(dialog, /insurance class/i, /COM — Commercial/)
    await choose(dialog, /insurance type/i, /^Medicaid$/)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save insurance' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ payerId: '', claimFormat: '837P', insuranceType: 'MC' }),
    )
  }, 15_000)
})
