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
import { resetPatientRecords } from '../../data/patient-records-store'
import {
  ICD10,
  authorization,
  coverage,
  insurance,
  insuranceClass,
  patient,
  patientCase,
  practice,
  referrer,
} from '../test-fixtures'

// Patients are frontend only: their in-tab store starts from known records.
// The other features' lists are faked by path, never imported.
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
  practicesMock.mockReset().mockResolvedValue([practice(1, 'Harborline Physical Therapy')])
  insurancesMock
    .mockReset()
    .mockResolvedValue([
      insurance(1, 'Medicare Part B'),
      insurance(3, 'Aetna', { insuranceClassId: 3 }),
      insurance(5, 'Corvel Enterprise', { insuranceType: 'Workers Comp', insuranceClassId: 4 }),
      insurance(6, 'GEICO No-Fault', { insuranceType: 'PIP', insuranceClassId: 5 }),
    ])
  classesMock
    .mockReset()
    .mockResolvedValue([
      insuranceClass(1, 'Medicare'),
      insuranceClass(3, 'Commercial', { authorizationRequired: true }),
      insuranceClass(4, 'Worker’s Comp'),
      insuranceClass(5, 'Auto / No-Fault', { injuryDateRequired: true }),
    ])
  referrersMock
    .mockReset()
    .mockResolvedValue([referrer(1, 'Priya Natarajan, MD'), referrer(2, 'Thomas Beckett, MD')])
  resetPatientRecords({
    icd10: ICD10,
    patients: [
      patient({
        id: 'p1',
        firstName: 'Nadia',
        lastName: 'Okonkwo',
        ssn: '412-55-7781',
        guarantor: {
          name: 'Claire Okonkwo',
          relationship: 'Spouse',
          address: { line1: '140 Clinton Street', city: 'Brooklyn', state: 'NY', zip: '11201' },
        },
        notes: 'Prefers morning visits.',
      }),
    ],
    coverages: [
      coverage({ id: 'cv1', patientId: 'p1', insuranceId: 3, memberId: 'W284019733', groupNumber: '' }),
      coverage({
        id: 'cv2',
        patientId: 'p1',
        insuranceId: 1,
        memberId: '1EG4-TE5-MK72',
        groupNumber: 'NONE',
      }),
    ],
    cases: [
      patientCase({
        id: 'c1',
        patientId: 'p1',
        name: 'R shoulder 2026',
        primaryCoverageId: 'cv1',
        diagnoses: [
          { code: 'M75.101', description: 'Unspecified rotator cuff tear of right shoulder, not traumatic' },
          { code: 'M25.511', description: 'Pain in right shoulder' },
        ],
      }),
      patientCase({ id: 'c2', patientId: 'p1', name: 'Neck pain', referrerId: null, isActive: false }),
    ],
    authorizations: [
      authorization({ id: 'a1', caseId: 'c1', coverageId: 'cv1', number: 'UHC-2026-55120', used: 5 }),
      authorization({ id: 'a2', caseId: 'c1', coverageId: 'cv1', number: 'BC-2026-90155' }),
    ],
  })
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
const region = (name: string) => screen.findByRole('region', { name }, { timeout: 5000 })
/** The chart's case card, in its menu: where a case is switched or started. */
const caseCard = () =>
  within(screen.getByRole('navigation', { name: 'Patient chart' })).getByRole('button', {
    name: /Switch case/,
  })
/** The heading that opens the case part of the page, e.g. "Case: Neck pain Closed". */
const caseHeading = (name: string) =>
  screen.getByRole('heading', { level: 2, name: new RegExp(`^Case: ${name}`) })
async function pickCase(name: RegExp | string) {
  await userEvent.click(caseCard())
  await userEvent.click(await screen.findByRole('menuitem', { name }))
}

describe('the patient chart — header and Profile', () => {
  it('shows who the patient is, and opens on the Profile', async () => {
    renderAt('/patients/p1')
    const demographics = await region('Demographics')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Okonkwo Nadia')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Active')
    expect(screen.getByText('Billing ID 10412')).toBeVisible()
    // The insurance list arrives on its own: the header names the case's primary.
    await waitFor(() => expect(screen.getByText('Billing ID 10412').parentElement).toHaveTextContent('Aetna'))
    // One page: the patient, their insurance and the case, with a menu that
    // jumps between them and marks the part being read.
    expect(await region('Insurance coverage')).toBeInTheDocument()
    expect(await region('Case details')).toBeInTheDocument()
    const menu = screen.getByRole('navigation', { name: 'Patient chart' })
    expect(within(menu).getByRole('link', { name: 'Profile' })).toHaveAttribute('aria-current', 'location')
    expect(within(menu).getByRole('link', { name: /^Insurance/ })).toHaveTextContent('Insurance (2)')
    expect(within(menu).getByRole('link', { name: /^Diagnoses/ })).toHaveTextContent('Diagnoses (2)')
    expect(within(menu).getByRole('link', { name: /^Authorizations/ })).toHaveAttribute(
      'href',
      '#authorizations',
    )
    // The SSN only ever shows masked.
    expect(within(demographics).getByText('***-**-7781')).toBeVisible()
    expect(document.body).not.toHaveTextContent('412-55-7781')
    // The guarantor and their address.
    const guarantor = await region('Guarantor')
    expect(within(guarantor).getByText('Claire Okonkwo (Spouse)')).toBeVisible()
    expect(within(guarantor).getByText('140 Clinton Street, Brooklyn, NY 11201')).toBeVisible()
    // The notes sit with the guarantor, the IDs with the demographics, as in the prototype.
    expect(within(guarantor).getByText('Prefers morning visits.')).toBeVisible()
    expect(within(demographics).getByText('10412')).toBeVisible()
  }, 15_000) // The first render loads the whole one-page chart.

  it('jumps to a part of the chart from its menu, taking focus there', async () => {
    renderAt('/patients/p1')
    await region('Authorizations')
    const menu = screen.getByRole('navigation', { name: 'Patient chart' })
    await userEvent.click(within(menu).getByRole('link', { name: /^Authorizations/ }))
    expect(screen.getByRole('heading', { name: 'Authorizations' })).toHaveFocus()
    await userEvent.click(within(menu).getByRole('link', { name: /^Insurance/ }))
    expect(screen.getByRole('heading', { name: 'Insurance coverage' })).toHaveFocus()
  })

  it('switches the case from the case card in the menu, and the case part follows', async () => {
    const router = renderAt('/patients/p1')
    await region('Case details')
    expect(caseCard()).toHaveAccessibleName('Case: R shoulder 2026. Switch case or add a new one')
    expect(caseHeading('R shoulder 2026')).toHaveTextContent('Open')
    // The case's parts are listed under the card.
    const menu = screen.getByRole('navigation', { name: 'Patient chart' })
    expect(within(menu).getByRole('link', { name: 'Case details' })).toHaveAttribute('href', '#case')

    await userEvent.click(caseCard())
    expect(await screen.findByRole('menuitem', { name: /R shoulder 2026.*\(current\)/ })).toBeVisible()
    expect(screen.getByRole('menuitem', { name: /Neck pain.*Closed/ })).toBeVisible()
    expect(screen.getByRole('menuitem', { name: 'New case' })).toBeVisible()
    await userEvent.click(screen.getByRole('menuitem', { name: /Neck pain/ }))

    await waitFor(() => expect(router.state.location.search).toEqual({ case: 'c2' }))
    expect(router.state.location.pathname).toBe('/patients/p1')
    expect(caseCard()).toHaveAccessibleName('Case: Neck pain. Switch case or add a new one')
    expect(caseCard()).toHaveTextContent('2 cases ·')
    expect(caseHeading('Neck pain')).toHaveTextContent('Closed')
    expect(screen.getByText(/2 of 2 cases/)).toBeVisible()
    // Its details follow: this case has no referring physician yet.
    expect(
      within(screen.getByRole('region', { name: 'Case details' })).getAllByText('Required for billing')
        .length,
    ).toBeGreaterThan(0)
    // The rest of the page is still the patient's.
    expect(screen.getByRole('region', { name: 'Demographics' })).toBeInTheDocument()
  })

  it('edits the patient — an empty SSN keeps the one on file', async () => {
    renderAt('/patients/p1')
    // "Edit patient" heads the Profile card: it edits all of its groups.
    await userEvent.click(within(await region('Profile')).getByRole('button', { name: 'Edit patient' }))
    const dialog = screen.getByRole('dialog', { name: 'Edit Nadia Okonkwo' })
    // The red asterisk marks what is required; explanations sit behind the info icons.
    expect(within(dialog).queryByText(/Required for billing/)).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'About SSN' })).toHaveAccessibleDescription(
      'Stored encrypted; masked for everyone but System Admin.',
    )
    const ssn = within(dialog).getByRole('textbox', { name: /^ssn/i })
    expect(ssn).toHaveValue('')
    expect(ssn).toHaveAttribute('placeholder', '***-**-7781 — enter a new value to replace')
    expect(within(dialog).queryByRole('combobox', { name: /practice/i })).not.toBeInTheDocument()
    expect(within(dialog).getByRole('textbox', { name: /guarantor name/i })).toHaveValue('Claire Okonkwo')

    const phone = within(dialog).getByRole('textbox', { name: /cell phone/i })
    await userEvent.clear(phone)
    await userEvent.type(phone, '718-555-0199')
    // The patient receives the statements from now on: the guarantor goes.
    await userEvent.click(within(dialog).getByRole('combobox', { name: /who receives statements/i }))
    await userEvent.click(screen.getByRole('option', { name: 'The patient' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save patient' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(within(await region('Contact & address')).getByText('718-555-0199')).toBeVisible()
    expect(within(await region('Guarantor')).getByText('The patient')).toBeVisible()
    expect(within(await region('Demographics')).getByText('***-**-7781')).toBeVisible()
    expect(toasts()).toEqual([expect.objectContaining({ title: 'Patient saved' })])
  })

  it('deactivates the patient from More, after asking', async () => {
    renderAt('/patients/p1')
    await region('Demographics')
    await userEvent.click(screen.getByRole('button', { name: 'More actions for Nadia Okonkwo' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Deactivate patient' }))
    await userEvent.click(
      within(screen.getByRole('alertdialog', { name: 'Deactivate this patient?' })).getByRole('button', {
        name: 'Deactivate',
      }),
    )
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Inactive'))
  })

  it('deletes the patient from More, after asking, and goes back to the roster', async () => {
    const router = renderAt('/patients/p1')
    await region('Demographics')
    await userEvent.click(screen.getByRole('button', { name: 'More actions for Nadia Okonkwo' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete patient' }))
    const confirm = screen.getByRole('alertdialog', { name: 'Delete Nadia Okonkwo?' })
    expect(
      within(confirm).getByText('The patient and their cases are removed. This cannot be undone.'),
    ).toBeVisible()
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete patient' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/patients'))
    expect(await screen.findByText('No patients yet')).toBeVisible()
    expect(toasts()).toEqual([expect.objectContaining({ title: 'Patient deleted' })])
  })

  it('says so for a patient that is not there', async () => {
    renderAt('/patients/nobody')
    expect(await screen.findByText('Patient not found', undefined, { timeout: 5000 })).toBeVisible()
  })
})

describe('the patient chart — Insurance', () => {
  it('lists the patient’s coverage, what uses it and what is missing', async () => {
    renderAt('/patients/p1')
    const list = within(await region('Insurance coverage')).getByRole('list', { name: 'Coverage' })
    await within(list).findByText('1003 – Aetna')
    const [aetna, medicare] = within(list).getAllByRole('listitem')
    expect(aetna).toHaveTextContent('1003 – Aetna')
    expect(aetna).toHaveTextContent('Primary · R shoulder 2026')
    expect(aetna).toHaveTextContent('Commercial · Commercial · Payer ID PAY3 · Authorization required')
    expect(aetna).toHaveTextContent('Missing — required for billing')
    expect(aetna).toHaveTextContent('The patient (self)')
    expect(medicare).toHaveTextContent('Not used on a case yet')
  })

  it('refuses to remove a coverage a case uses, and removes one after asking', async () => {
    renderAt('/patients/p1')
    await region('Insurance coverage')
    await userEvent.click(await screen.findByRole('button', { name: 'Remove coverage 1003 – Aetna' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(toasts()).toEqual([
      expect.objectContaining({
        tone: 'warning',
        title: 'This coverage is used on a case',
        description: 'Choose another insurance on “R shoulder 2026” first.',
      }),
    ])

    await userEvent.click(screen.getByRole('button', { name: 'Remove coverage 1001 – Medicare Part B' }))
    const confirm = screen.getByRole('alertdialog', { name: 'Remove this coverage?' })
    expect(
      within(confirm).getByText('Medicare Part B is removed from the patient’s insurance list.'),
    ).toBeVisible()
    await userEvent.click(within(confirm).getByRole('button', { name: 'Remove coverage' }))
    await waitFor(() => expect(screen.queryByText('1001 – Medicare Part B')).not.toBeInTheDocument())
  })

  it('adds a coverage — the claim number, subscriber and employer as the insurance and relationship need', async () => {
    renderAt('/patients/p1')
    await region('Insurance coverage')
    await userEvent.click(screen.getByRole('button', { name: 'Add coverage' }))
    const dialog = screen.getByRole('dialog', { name: 'Add coverage' })
    expect(within(dialog).queryByRole('textbox', { name: /subscriber name/i })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('textbox', { name: /employer name/i })).not.toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Add coverage' }))
    expect(await within(dialog).findByText('Select an insurance.')).toBeVisible()
    expect(within(dialog).getByText('Enter the member ID.')).toBeVisible()
    expect(within(dialog).getByText('Enter the group number.')).toBeVisible()

    // Workers' Comp: a claim number and the employer.
    await userEvent.click(within(dialog).getByRole('combobox', { name: /^insurance/i }))
    await userEvent.click(await screen.findByRole('option', { name: /Corvel Enterprise/ }))
    expect(within(dialog).getByRole('textbox', { name: /employer name/i })).toBeInTheDocument()
    // Someone else is the subscriber: their name and date of birth.
    await userEvent.click(within(dialog).getByRole('combobox', { name: /relationship to subscriber/i }))
    await userEvent.click(screen.getByRole('option', { name: 'Spouse' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add coverage' }))
    expect(await within(dialog).findByText('Enter the claim number.')).toBeVisible()
    expect(within(dialog).getByText('Enter the subscriber’s name.')).toBeVisible()
    expect(within(dialog).getByText('Enter the subscriber’s date of birth.')).toBeVisible()
    expect(within(dialog).getByText('Enter the employer’s name.')).toBeVisible()

    await userEvent.type(within(dialog).getByRole('textbox', { name: /member id/i }), 'WC-4417260')
    await userEvent.type(within(dialog).getByRole('textbox', { name: /group number/i }), 'EMP-22019')
    await userEvent.type(within(dialog).getByRole('textbox', { name: /claim number/i }), '1439WC260300330')
    await userEvent.type(within(dialog).getByRole('textbox', { name: /subscriber name/i }), 'Chidi Okonkwo')
    await userEvent.type(within(dialog).getByRole('textbox', { name: /subscriber dob/i }), '03/02/1982')
    await userEvent.type(within(dialog).getByRole('textbox', { name: /employer name/i }), 'Atlas Freight LLC')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add coverage' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const list = within(await region('Insurance coverage')).getByRole('list', { name: 'Coverage' })
    const added = within(list).getAllByRole('listitem').at(-1) as HTMLElement
    expect(added).toHaveTextContent('1005 – Corvel Enterprise')
    expect(added).toHaveTextContent('Chidi Okonkwo · Spouse · 03/02/1982')
    expect(added).toHaveTextContent('Atlas Freight LLC')
    expect(toasts()).toEqual([
      expect.objectContaining({
        title: 'Coverage saved',
        description: 'Choose it on a case as the primary or secondary insurance.',
      }),
    ])
  }, 20_000)

  it('says what is needed first when the practice has no insurance', async () => {
    insurancesMock.mockReset().mockResolvedValue([])
    renderAt('/patients/p1')
    await region('Insurance coverage')
    await waitFor(() => expect(insurancesMock).toHaveBeenCalled())
    await userEvent.click(screen.getByRole('button', { name: 'Add coverage' }))
    const dialog = await screen.findByRole('dialog', { name: 'Cannot add coverage yet' })
    expect(within(dialog).getByRole('link', { name: 'Add an insurance' })).toHaveAttribute(
      'href',
      '/setup/insurances',
    )
  })
})

describe('the patient chart — Case overview', () => {
  it('shows the open case: details, insurance, diagnoses in pointer order, authorizations, other cases', async () => {
    const router = renderAt('/patients/p1')
    const details = await region('Case details')
    // The case part opens on the case it shows.
    expect(caseHeading('R shoulder 2026')).toBeInTheDocument()
    expect(
      await within(details).findByText('Priya Natarajan, MD · Referring (DN) · NPI 1720394851'),
    ).toBeVisible()
    expect(within(await region('Insurance')).getByText('1003 – Aetna')).toBeVisible()
    expect(within(await region('Insurance')).getByText(/Authorization required/)).toBeVisible()
    const diagnoses = within(await region('Diagnoses (ICD-10)')).getByRole('list', { name: 'Diagnoses' })
    expect(
      within(diagnoses)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([expect.stringContaining('M75.101'), expect.stringContaining('M25.511')])
    expect(
      within(await region('Authorizations')).getByText(
        'The primary insurance requires authorization — visits without one are pended',
      ),
    ).toBeVisible()
    expect(router.state.location.search).toEqual({})

    // Switching case: the other case, with what billing still needs.
    await pickCase(/Neck pain/)
    await waitFor(() => expect(router.state.location.search).toEqual({ case: 'c2' }))
    const other = await region('Case details')
    expect(caseHeading('Neck pain')).toBeInTheDocument()
    expect(within(other).getAllByText('Required for billing').length).toBeGreaterThan(0)
    expect(
      within(await region('Insurance')).getByText('Not chosen — visits on this case are pended until it is.'),
    ).toBeVisible()
  })

  it('edits the case with the prototype’s checks — the injury date and accident state follow the related cause', async () => {
    renderAt('/patients/p1?case=c2')
    await userEvent.click(within(await region('Case details')).getByRole('button', { name: 'Edit case' }))
    const dialog = screen.getByRole('dialog', { name: 'Edit case' })
    // Field explanations sit behind the info icon beside each label, not under the inputs.
    expect(within(dialog).getByRole('button', { name: 'About Accident state' })).toHaveAccessibleDescription(
      'Box 10b when auto related.',
    )
    expect(within(dialog).queryByText('Box 10b when auto related.')).not.toBeVisible()
    expect(within(dialog).getByRole('textbox', { name: /injury \/ onset date/i })).toBeDisabled()
    expect(within(dialog).getByRole('textbox', { name: /accident state/i })).toBeDisabled()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Save case' }))
    expect(await within(dialog).findByText('Select the referring physician.')).toBeVisible()
    expect(within(dialog).getByText('Select the primary insurance.')).toBeVisible()

    await userEvent.click(within(dialog).getByRole('combobox', { name: /related cause/i }))
    await userEvent.click(screen.getByRole('option', { name: 'Auto' }))
    expect(within(dialog).getByRole('textbox', { name: /accident state/i })).toBeEnabled()
    await userEvent.click(within(dialog).getByRole('combobox', { name: /^primary insurance/i }))
    await userEvent.click(screen.getByRole('option', { name: /Aetna/ }))
    await userEvent.click(within(dialog).getByRole('combobox', { name: /^secondary insurance/i }))
    await userEvent.click(screen.getByRole('option', { name: /Aetna/ }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save case' }))
    expect(await within(dialog).findByText('Enter the injury or onset date.')).toBeVisible()
    expect(within(dialog).getByText('Enter the accident state.')).toBeVisible()
    expect(within(dialog).getByText('Choose a different insurance from the primary.')).toBeVisible()

    await userEvent.click(within(dialog).getByRole('combobox', { name: /referring physician/i }))
    await userEvent.click(await screen.findByRole('option', { name: /Thomas Beckett/ }))
    await userEvent.click(within(dialog).getByRole('combobox', { name: /^secondary insurance/i }))
    await userEvent.click(screen.getByRole('option', { name: /Medicare/ }))
    await userEvent.type(within(dialog).getByRole('textbox', { name: /injury \/ onset date/i }), '08/09/2026')
    await userEvent.type(within(dialog).getByRole('textbox', { name: /accident state/i }), 'ny')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save case' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const details = await region('Case details')
    expect(within(details).getByText(/Thomas Beckett, MD/)).toBeVisible()
    expect(within(details).getByText('Auto')).toBeVisible()
    expect(within(details).getByText('08/09/2026')).toBeVisible()
    expect(within(details).getByText('NY')).toBeVisible()
    expect(within(await region('Insurance')).getByText('1001 – Medicare Part B')).toBeVisible()
    expect(toasts()).toEqual([expect.objectContaining({ title: 'Case saved' })])
  }, 20_000)

  it('creates a new case and shows it', async () => {
    const router = renderAt('/patients/p1')
    await region('Case details')
    // Started from the case card, like switching.
    await pickCase('New case')
    const dialog = await screen.findByRole('dialog', { name: 'New case' })
    await userEvent.type(within(dialog).getByRole('textbox', { name: /case name/i }), 'L knee 2026')
    await userEvent.click(within(dialog).getByRole('combobox', { name: /referring physician/i }))
    await userEvent.click(await screen.findByRole('option', { name: /Priya Natarajan/ }))
    await userEvent.click(within(dialog).getByRole('combobox', { name: /^primary insurance/i }))
    await userEvent.click(screen.getByRole('option', { name: /Medicare/ }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create case' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(caseHeading('L knee 2026')).toBeInTheDocument())
    expect(caseCard()).toHaveAccessibleName('Case: L knee 2026. Switch case or add a new one')
    expect(String((router.state.location.search as { case?: string }).case)).toMatch(/^case-\d+$/)
    expect(toasts()).toEqual([expect.objectContaining({ title: 'Case created' })])
  })

  it('adds, reorders and removes diagnoses — the position is the pointer', async () => {
    renderAt('/patients/p1')
    const section = await region('Diagnoses (ICD-10)')
    await userEvent.click(within(section).getByRole('button', { name: 'Add diagnosis' }))
    const dialog = screen.getByRole('dialog', { name: 'Add diagnosis' })
    expect(within(dialog).getByText('Pointer 3 of 12.')).toBeVisible()
    await userEvent.click(within(dialog).getByRole('combobox', { name: /icd-10 code/i }))
    // Codes already on the case are not offered again.
    expect(screen.queryByRole('option', { name: /M25\.511/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('option', { name: /M54\.2/ }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add diagnosis' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(toasts()).toEqual([expect.objectContaining({ title: 'M54.2 added as pointer 3' })])

    const order = () =>
      within(within(section).getByRole('list', { name: 'Diagnoses' }))
        .getAllByRole('listitem')
        .map((item) => item.textContent?.match(/[A-Z]\d{2}\.\w+/)?.[0])
    expect(order()).toEqual(['M75.101', 'M25.511', 'M54.2'])
    await userEvent.click(within(section).getByRole('button', { name: 'Move M54.2 up' }))
    expect(order()).toEqual(['M75.101', 'M54.2', 'M25.511'])
    expect(within(section).getByRole('button', { name: 'Move M75.101 up' })).toBeDisabled()

    await userEvent.click(within(section).getByRole('button', { name: 'Remove M75.101' }))
    const confirm = screen.getByRole('alertdialog', { name: 'Remove M75.101?' })
    expect(
      within(confirm).getByText(
        'Pointers after it move up by one. Visits already received keep their snapshot.',
      ),
    ).toBeVisible()
    await userEvent.click(within(confirm).getByRole('button', { name: 'Remove diagnosis' }))
    await waitFor(() => expect(order()).toEqual(['M54.2', 'M25.511']))
  })

  it('adds an authorization, refuses deleting a used one, and deletes another after asking', async () => {
    renderAt('/patients/p1')
    const section = await region('Authorizations')
    await userEvent.click(
      within(section).getByRole('button', { name: 'Delete authorization UHC-2026-55120' }),
    )
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(toasts()).toEqual([
      expect.objectContaining({
        tone: 'warning',
        title: 'This authorization has been used',
        description: 'Visits already consumed it, so it cannot be deleted.',
      }),
    ])

    await userEvent.click(within(section).getByRole('button', { name: 'Delete authorization BC-2026-90155' }))
    await userEvent.click(
      within(screen.getByRole('alertdialog', { name: 'Delete authorization BC-2026-90155?' })).getByRole(
        'button',
        {
          name: 'Delete authorization',
        },
      ),
    )
    await waitFor(() => expect(within(section).queryByText('BC-2026-90155')).not.toBeInTheDocument())

    await userEvent.click(within(section).getByRole('button', { name: 'Add authorization' }))
    const dialog = screen.getByRole('dialog', { name: 'Add authorization' })
    expect(within(dialog).getByRole('combobox', { name: /issued by/i })).toHaveTextContent('Aetna (primary)')
    await userEvent.type(within(dialog).getByRole('textbox', { name: /authorization number/i }), '0VJL671TT')
    await userEvent.type(within(dialog).getByRole('textbox', { name: /start date/i }), '09/01/2026')
    await userEvent.type(within(dialog).getByRole('textbox', { name: /end date/i }), '08/01/2026')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save authorization' }))
    expect(await within(dialog).findByText('Please enter a valid date.')).toBeVisible()
    expect(within(dialog).getByText('Enter how many were approved.')).toBeVisible()

    const end = within(dialog).getByRole('textbox', { name: /end date/i })
    await userEvent.clear(end)
    await userEvent.type(end, '12/31/2099')
    await userEvent.type(within(dialog).getByRole('spinbutton', { name: /approved/i }), '6')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save authorization' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(within(section).getByText('0VJL671TT')).toBeInTheDocument()
    expect(toasts().at(-1)).toEqual(expect.objectContaining({ title: 'Authorization 0VJL671TT saved' }))
  }, 20_000)
})
