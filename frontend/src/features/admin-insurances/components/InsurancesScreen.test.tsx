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
import { createInsurance, listInsurances, updateInsurance } from '../api/insurances-api'
import type { Insurance } from '../schemas/insurance'
import type { InsuranceClass } from '../schemas/insurance-class'
import { bucket, insurance, insuranceClass, practice } from './test-fixtures'

// Only the integration points are faked: this feature's api functions, the
// practices list and the release buckets list. Everything above runs for real.
vi.mock('../api/insurances-api', () => ({
  listInsurances: vi.fn(),
  createInsurance: vi.fn(),
  updateInsurance: vi.fn(),
}))
vi.mock('../api/insurance-classes-api', () => ({
  listInsuranceClasses: vi.fn(),
  createInsuranceClass: vi.fn(),
  updateInsuranceClass: vi.fn(),
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
}))

const listMock = vi.mocked(listInsurances)
const createMock = vi.mocked(createInsurance)
const updateMock = vi.mocked(updateInsurance)
const classesMock = vi.mocked(listInsuranceClasses)

let insurances: Insurance[]
let classes: InsuranceClass[]

beforeEach(() => {
  classes = [
    insuranceClass(1, 1, 'MED', 'Medicare', { authorization_required: true }),
    insuranceClass(3, 1, 'COM', 'Commercial'),
    insuranceClass(4, 1, 'OLD', 'Retired class', { is_active: false }),
    insuranceClass(7, 2, 'MED', 'Northgate Medicare'),
  ]
  insurances = [
    insurance(1, 1, 1, 1001, 'Medicare Part B', {
      insurance_type: 'Medicare',
      payer_id: '13202',
      portal_url: 'https://portal.example-medicare.gov',
    }),
    insurance(2, 1, 3, 1039, 'Corvel Enterprise', {
      audit_required: true,
      insurance_hold: true,
      release_bucket_id: 1,
      authorization_required: false,
    }),
    insurance(3, 2, 7, 2001, 'Northgate Medicare Part B', { is_active: false }),
  ]
  listMock.mockReset().mockImplementation(() => Promise.resolve(structuredClone(insurances)))
  classesMock.mockReset().mockImplementation(() => Promise.resolve(structuredClone(classes)))
  practicesMock
    .mockReset()
    .mockResolvedValue([practice(1, 'Harborline Physical Therapy'), practice(2, 'Northgate Sports & Spine')])
  bucketsMock
    .mockReset()
    .mockResolvedValue([
      bucket(1, 1, 'Manual Release – WC Payers'),
      bucket(2, 1, 'Manual Release – Auto / No-Fault'),
      bucket(4, 2, 'Manual Release – Northgate'),
    ])
  createMock.mockReset().mockImplementation(() => Promise.resolve(insurances[0] as Insurance))
  updateMock.mockReset().mockImplementation(() => Promise.resolve(insurances[0] as Insurance))
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

const table = () => screen.findByRole('table', { name: 'Insurances' })

async function openNew() {
  await userEvent.click(await screen.findByRole('button', { name: 'New insurance' }))
  return screen.getByRole('dialog')
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
  it('lists every payer with its class and type, payer ID, portal link, hold, audit and status', async () => {
    renderAt()
    // The first test pays for loading the route's code-split chunk.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Insurances' }, { timeout: 5000 }),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('navigation', { name: 'Setup' })).getByRole('link', { name: 'Insurances' }),
    ).toHaveAttribute('data-status', 'active')
    const rows = within(await table()).getAllByRole('row')
    const medicare = within(rows[1] as HTMLElement)
    expect(medicare.getByText('1001 – Medicare Part B')).toBeInTheDocument()
    expect(rows[1]).toHaveTextContent('Medicare · Medicare')
    expect(medicare.getByText('13202')).toBeInTheDocument()
    const portal = medicare.getByRole('link', { name: /payer portal/i })
    expect(portal).toHaveAttribute('href', 'https://portal.example-medicare.gov')
    expect(portal).toHaveAttribute('target', '_blank')
    expect(portal).toHaveAttribute('rel', 'noopener noreferrer')
    expect(medicare.getByRole('switch', { name: /: active$/ })).toBeChecked()

    const corvel = within(rows[2] as HTMLElement)
    expect(corvel.getByText('Manual release')).toBeInTheDocument()
    expect(corvel.getByText('Manual Release – WC Payers')).toBeInTheDocument()
    expect(corvel.getAllByText('Audit required').length).toBeGreaterThan(0)
    expect(within(rows[3] as HTMLElement).getByRole('switch', { name: /: active$/ })).not.toBeChecked()
  })

  it('deactivates an insurance from its row with the Active switch, changing only is_active', async () => {
    renderAt()
    const rows = within(await table()).getAllByRole('row')
    const toggle = within(rows[1] as HTMLElement).getByRole('switch', { name: /: active$/ })
    await userEvent.click(toggle)
    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1))
    const [, values] = updateMock.mock.calls[0] ?? []
    expect(values).toEqual(expect.objectContaining({ isActive: false }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('filters to one practice from the URL', async () => {
    renderAt('/setup/insurances?practice=2')
    const rows = within(await table()).getAllByRole('row')
    expect(rows).toHaveLength(2)
    expect(within(rows[1] as HTMLElement).getByText('2001 – Northgate Medicare Part B')).toBeInTheDocument()
  })

  it('shows a loading state, then a failed load with a retry', async () => {
    listMock.mockRejectedValueOnce(new ApiError({ kind: 'unavailable', message: 'Down.' }))
    renderAt()
    expect(await screen.findByRole('status')).toHaveTextContent('Loading')
    await userEvent.click(await screen.findByRole('button', { name: /try again/i }))
    expect(within(await table()).getByText('1001 – Medicare Part B')).toBeInTheDocument()
  })

  it('explains an empty list and offers to add the first insurance', async () => {
    insurances = []
    renderAt()
    expect(await screen.findByText('No insurances yet')).toBeInTheDocument()
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
      'Enter the payer ID.',
    ]) {
      expect(await within(dialog).findByText(message)).toBeInTheDocument()
    }
    expect(createMock).not.toHaveBeenCalled()
  })

  it('adds an insurance with its class, audit flag and portal link — and no portal credentials', async () => {
    renderAt('/setup/insurances?practice=1')
    const dialog = await openNew()
    // The practice comes from the filter; only its active classes are offered.
    expect(await optionNames(dialog, /insurance class/i)).toEqual(['MED — Medicare', 'COM — Commercial'])
    await userEvent.type(within(dialog).getByRole('textbox', { name: /^code/i }), '1060')
    await userEvent.type(within(dialog).getByRole('textbox', { name: /^name/i }), 'Oscar Health')
    await choose(dialog, /insurance class/i, /COM — Commercial/)
    await choose(dialog, /insurance type/i, /^Commercial$/)
    await userEvent.type(within(dialog).getByRole('textbox', { name: /payer id/i }), 'OSCAR')
    const portal = within(dialog).getByRole('textbox', { name: /payer portal link/i })
    expect(portal).toHaveAttribute('placeholder', 'Enter payer portal URL')
    await userEvent.type(portal, 'https://portal.example-payer.com')
    expect(within(dialog).queryByLabelText(/portal (user|password)/i)).not.toBeInTheDocument()

    const audit = within(dialog).getByRole('switch', { name: 'Audit required' })
    expect(audit).not.toBeChecked()
    await userEvent.click(audit)
    expect(audit).toBeChecked()
    expect(within(dialog).getByRole('switch', { name: 'Active' })).toBeChecked()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Save insurance' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        practiceId: '1',
        code: '1060',
        name: 'Oscar Health',
        insuranceClassId: '3',
        insuranceType: 'Commercial',
        payerId: 'OSCAR',
        portalUrl: 'https://portal.example-payer.com',
        auditRequired: true,
        insuranceHold: false,
        authorizationRequired: 'inherit',
        isActive: true,
      }),
    )
    expect(await screen.findByText('Insurance saved')).toBeInTheDocument()
  }, 15_000)

  it('asks for a release bucket of the practice only while the insurance hold is on', async () => {
    renderAt('/setup/insurances?practice=1')
    const dialog = await openNew()
    expect(within(dialog).queryByRole('combobox', { name: /release bucket/i })).not.toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('switch', { name: 'Insurance hold' }))
    // Only this practice's buckets are offered.
    expect(await optionNames(dialog, /release bucket/i)).toEqual([
      'Manual Release – WC Payers',
      'Manual Release – Auto / No-Fault',
    ])
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save insurance' }))
    expect(await within(dialog).findByText('Select a release bucket.')).toBeInTheDocument()
  })

  it('shows each rule’s effective value, from the class or overridden', async () => {
    renderAt()
    await userEvent.click(await screen.findByRole('button', { name: 'Edit 1001 – Medicare Part B' }))
    const dialog = screen.getByRole('dialog')
    const panel = within(dialog).getByRole('region', { name: 'Effective values' })
    const authRow = () => within(panel).getByText('Authorization required').parentElement as HTMLElement
    expect(authRow()).toHaveTextContent(/Yes\s*from the class/)
    await choose(dialog, /^authorization required/i, /No — override/)
    expect(authRow()).toHaveTextContent(/No\s*overridden/)
  })

  it('edits an insurance: the practice stays fixed, Active is switched off in the form', async () => {
    renderAt()
    await userEvent.click(await screen.findByRole('button', { name: 'Edit 1001 – Medicare Part B' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: '1001 – Medicare Part B' })).toBeInTheDocument()
    expect(within(dialog).getByRole('combobox', { name: /^practice/i })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    expect(within(dialog).getByRole('textbox', { name: /payer portal link/i })).toHaveValue(
      'https://portal.example-medicare.gov',
    )
    await userEvent.click(within(dialog).getByRole('switch', { name: 'Active' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save insurance' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(updateMock).toHaveBeenCalledWith(1, expect.objectContaining({ isActive: false, code: '1001' }))
  })

  it('puts a server’s field error back on the field', async () => {
    updateMock.mockRejectedValueOnce(
      new ApiError({
        kind: 'validation',
        message: 'Some fields need attention.',
        fieldErrors: [{ path: 'code', message: 'This code is already used in this practice.' }],
      }),
    )
    renderAt()
    await userEvent.click(await screen.findByRole('button', { name: 'Edit 1001 – Medicare Part B' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save insurance' }))
    expect(await screen.findByText('This code is already used in this practice.')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('points to Insurance classes when the practice has no active class', async () => {
    classes = classes.filter((record) => record.practiceId !== 2)
    renderAt('/setup/insurances?practice=2')
    const dialog = await openNew()
    const link = await within(dialog).findByRole('link', { name: 'Create an insurance class' })
    expect(link).toHaveAttribute('href', '/setup/insurance-classes?practice=2')
  })
})
