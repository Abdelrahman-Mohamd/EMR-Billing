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
import {
  deletePatient,
  getPatient,
  listPatients,
  setPatientActive,
  updatePatient,
} from '../../api/patients-api'
import {
  createAuthorization,
  deleteAuthorization,
  listAuthorizations,
  updateAuthorization,
} from '../../api/authorizations-api'
import {
  createCaseInsurance,
  deleteCaseInsurance,
  listCaseInsurances,
  updateCaseInsurance,
} from '../../api/case-insurances-api'
import {
  createPatientCase,
  deletePatientCase,
  listPatientCases,
  updatePatientCase,
} from '../../api/patient-cases-api'
import { createCaseDiagnosis, deleteCaseDiagnosis, updateCaseDiagnosis } from '../../api/case-diagnoses-api'
import type { Authorization } from '../../model/authorization'
import type { PatientCase } from '../../model/case'
import type { Coverage } from '../../model/coverage'
import type { Patient } from '../../model/patient'
import type { PatientFormValues } from '../../schemas/patient-form'
import {
  asServerCase,
  authorization,
  coverage,
  insurance,
  insuranceClass,
  patient,
  patientCase,
  practice,
  referrer,
} from '../test-fixtures'

// The patients api is faked at its integration point, answering as the
// server does.
// The other features' lists are faked by path, never imported.
vi.mock('../../api/patients-api', () => ({
  listPatients: vi.fn(),
  getPatient: vi.fn(),
  createPatient: vi.fn(),
  updatePatient: vi.fn(),
  updatePatientFields: vi.fn(),
  setPatientActive: vi.fn(),
  deletePatient: vi.fn(),
}))
// The cases are the server's too, faked the same way.
vi.mock('../../api/patient-cases-api', () => ({
  listPatientCases: vi.fn(),
  createPatientCase: vi.fn(),
  updatePatientCase: vi.fn(),
  updatePatientCaseFields: vi.fn(),
  deletePatientCase: vi.fn(),
}))
// And the cases' diagnoses.
vi.mock('../../api/case-diagnoses-api', () => ({
  createCaseDiagnosis: vi.fn(),
  updateCaseDiagnosis: vi.fn(),
  deleteCaseDiagnosis: vi.fn(),
}))
// And the cases' insurances.
vi.mock('../../api/case-insurances-api', () => ({
  listCaseInsurances: vi.fn(),
  createCaseInsurance: vi.fn(),
  updateCaseInsurance: vi.fn(),
  setCaseInsuranceSubscriber: vi.fn(),
  deleteCaseInsurance: vi.fn(),
}))
// And the authorizations those issued.
vi.mock('../../api/authorizations-api', () => ({
  listAuthorizations: vi.fn(),
  createAuthorization: vi.fn(),
  updateAuthorization: vi.fn(),
  deleteAuthorization: vi.fn(),
}))
const listAuthsMock = vi.mocked(listAuthorizations)
const createAuthMock = vi.mocked(createAuthorization)
const updateAuthMock = vi.mocked(updateAuthorization)
const deleteAuthMock = vi.mocked(deleteAuthorization)
let auths: Authorization[]

const listCoveragesMock = vi.mocked(listCaseInsurances)
const createCoverageMock = vi.mocked(createCaseInsurance)
const updateCoverageMock = vi.mocked(updateCaseInsurance)
const deleteCoverageMock = vi.mocked(deleteCaseInsurance)
let coverages: Coverage[]

const listCasesMock = vi.mocked(listPatientCases)
const createCaseMock = vi.mocked(createPatientCase)
const updateCaseMock = vi.mocked(updatePatientCase)
const createDiagnosisMock = vi.mocked(createCaseDiagnosis)
const updateDiagnosisMock = vi.mocked(updateCaseDiagnosis)
const deleteDiagnosisMock = vi.mocked(deleteCaseDiagnosis)
const deleteCaseMock = vi.mocked(deletePatientCase)
const INJURY_LABELS: Record<string, string> = {
  auto: 'Auto Accident',
  employment: 'Employment Related',
  other: 'Other',
}
let cases: PatientCase[]

const listMock = vi.mocked(listPatients)
const getMock = vi.mocked(getPatient)
const updateMock = vi.mocked(updatePatient)
const setActiveMock = vi.mocked(setPatientActive)
const deleteMock = vi.mocked(deletePatient)

let patients: Patient[]

/** What the server would hold after a save with these values (the parts these tests read). */
const saved = (current: Patient, values: PatientFormValues): Patient => ({
  ...current,
  phoneCell: values.phoneCell.replace(/\D/g, ''),
  guarantor:
    values.guarantorType === 'other'
      ? {
          firstName: values.guarantorFirstName,
          lastName: values.guarantorLastName,
          relationship: values.guarantorRelationship ?? '',
          dob: values.guarantorDob,
          address: current.guarantor?.address ?? null,
        }
      : null,
})
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
  insurancesMock.mockReset().mockResolvedValue([
    insurance(1, 'Medicare Part B'),
    insurance(3, 'Aetna', { insuranceClassId: 3 }),
    insurance(5, 'Corvel Enterprise', {
      insuranceType: 'WC',
      insuranceTypeLabel: "Workers' Comp",
      insuranceClassId: 4,
    }),
    insurance(6, 'GEICO No-Fault', {
      insuranceType: 'AM',
      insuranceTypeLabel: 'Auto / PIP',
      insuranceClassId: 5,
    }),
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
  patients = [
    patient({
      id: 'p1',
      firstName: 'Nadia',
      lastName: 'Okonkwo',
      maskedSsn: '***-**-7781',
      guarantor: {
        firstName: 'Claire',
        lastName: 'Okonkwo',
        relationship: 'Spouse',
        dob: '',
        address: { line1: '140 Clinton Street', city: 'Brooklyn', state: 'NY', zip: '11201' },
      },
      notes: 'Prefers morning visits.',
    }),
    // A patient added on the server: their "Default" case is the server's.
    patient({
      id: '7',
      firstName: 'Ada',
      lastName: 'Lin',
    }),
  ]
  listMock.mockReset().mockImplementation(() => Promise.resolve(structuredClone(patients)))
  getMock.mockReset().mockImplementation((id) => {
    const found = patients.find((item) => item.id === id)
    return found
      ? Promise.resolve(structuredClone(found))
      : Promise.reject(new ApiError({ kind: 'not_found', message: 'Not found', status: 404 }))
  })
  updateMock.mockReset().mockImplementation((id, values) => {
    patients = patients.map((item) => (item.id === id ? saved(item, values) : item))
    return Promise.resolve('Patient updated successfully')
  })
  setActiveMock.mockReset().mockImplementation((id, isActive) => {
    patients = patients.map((item) => (item.id === id ? { ...item, isActive } : item))
    return Promise.resolve('Patient updated successfully')
  })
  deleteMock.mockReset().mockImplementation((id) => {
    patients = patients.filter((item) => item.id !== id)
    return Promise.resolve('Patient deleted successfully')
  })
  cases = [
    patientCase({
      id: 'c1',
      patientId: 'p1',
      name: 'R shoulder 2026',
      diagnoses: [
        { id: '1', code: 'M75.101', description: 'Rotator cuff tear, right shoulder' },
        { id: '2', code: 'M25.511', description: '' },
      ],
    }),
    patientCase({ id: 'c2', patientId: 'p1', name: 'Neck pain', referrerId: null, isActive: false }),
    // The server's "Default" case of a patient added on the server.
    patientCase({ id: '31', patientId: '7', name: 'Default', referrerId: null, startOfCare: '' }),
  ]
  listCasesMock.mockReset().mockImplementation(() => Promise.resolve(cases.map(asServerCase)))
  createCaseMock.mockReset().mockImplementation((payload) => {
    cases = [
      ...cases,
      patientCase({
        id: '41',
        // This file's patient ids are text ('p1'), which a number cannot carry: the chart's own.
        patientId: Number.isNaN(payload.patient_id) ? 'p1' : String(payload.patient_id),
        name: payload.name,
        referrerId: payload.referring_physician_id,
      }),
    ]
    return Promise.resolve('Patient case created successfully')
  })
  updateCaseMock.mockReset().mockImplementation((id, payload) => {
    cases = cases.map((item) =>
      item.id === id
        ? {
            ...item,
            name: payload.name,
            referrerId: payload.referring_physician_id,
            injuryType: payload.injury_type ?? '',
            injuryTypeLabel: INJURY_LABELS[payload.injury_type ?? ''] ?? '',
            injuryDate: payload.injury_date ?? '',
            accidentState: payload.accident_state ?? '',
            startOfCare: payload.start_of_care ?? '',
            dischargeDate: payload.discharge_date ?? '',
            isActive: payload.is_active,
          }
        : item,
    )
    return Promise.resolve('Patient case updated successfully')
  })
  // The server lists a case's diagnoses in the order they were added.
  let nextDiagnosisId = 10
  createDiagnosisMock.mockReset().mockImplementation((payload) => {
    const added = {
      id: String(nextDiagnosisId++),
      code: payload.icd10_code,
      description: payload.description ?? '',
    }
    // This file's case ids are text ('c1'), which a number cannot carry: the chart's own.
    const caseId = Number.isNaN(payload.case_id) ? 'c1' : String(payload.case_id)
    cases = cases.map((item) =>
      item.id === caseId ? { ...item, diagnoses: [...item.diagnoses, added] } : item,
    )
    return Promise.resolve('Case diagnosis created successfully')
  })
  updateDiagnosisMock.mockReset().mockImplementation((id, payload) => {
    cases = cases.map((item) => ({
      ...item,
      diagnoses: item.diagnoses.map((diagnosis) =>
        diagnosis.id === id
          ? { ...diagnosis, code: payload.icd10_code, description: payload.description ?? '' }
          : diagnosis,
      ),
    }))
    return Promise.resolve('Case diagnosis updated successfully')
  })
  deleteDiagnosisMock.mockReset().mockImplementation((id) => {
    cases = cases.map((item) => ({
      ...item,
      diagnoses: item.diagnoses.filter((diagnosis) => diagnosis.id !== id),
    }))
    return Promise.resolve('Case diagnosis deleted successfully')
  })
  deleteCaseMock.mockReset().mockImplementation((id) => {
    cases = cases.filter((item) => item.id !== id)
    return Promise.resolve('Patient case deleted successfully')
  })
  coverages = [
    coverage({
      id: 'cv1',
      caseId: 'c1',
      insuranceId: 3,
      insuranceLabel: '1003 – Aetna',
      insuranceName: 'Aetna',
      memberId: 'W284019733',
      groupNumber: '',
    }),
    coverage({
      id: 'cv2',
      caseId: 'c1',
      insuranceId: 1,
      insuranceLabel: '1001 – Medicare Part B',
      insuranceName: 'Medicare Part B',
      rank: 2,
      rankLabel: 'Secondary',
      memberId: '1EG4-TE5-MK72',
      groupNumber: 'NONE',
    }),
  ]
  listCoveragesMock.mockReset().mockImplementation(() => Promise.resolve(structuredClone(coverages)))
  createCoverageMock.mockReset().mockImplementation((payload) => {
    coverages = [
      ...coverages,
      coverage({
        id: 'cv9',
        caseId: String(payload.case_id),
        insuranceId: payload.insurance_id,
        insuranceLabel: '1005 – Corvel Enterprise',
        insuranceName: 'Corvel Enterprise',
        insuranceType: 'WC',
        rank: payload.rank,
        rankLabel: ['', 'Primary', 'Secondary', 'Tertiary'][payload.rank] ?? '',
        memberId: payload.member_id,
        claimNumber: payload.claim_number ?? '',
        subscriber:
          payload.subscriber === null
            ? null
            : {
                firstName: payload.subscriber.first_name,
                lastName: payload.subscriber.last_name,
                relationship: payload.subscriber.relationship,
                dob: payload.subscriber.date_of_birth ?? '',
                gender: payload.subscriber.gender ?? '',
              },
      }),
    ]
    return Promise.resolve('Case insurance created successfully')
  })
  updateCoverageMock.mockReset().mockImplementation((id, payload) => {
    coverages = coverages.map((item) =>
      item.id === id ? { ...item, memberId: payload.member_id, rank: payload.rank } : item,
    )
    return Promise.resolve('Case insurance updated successfully')
  })
  deleteCoverageMock.mockReset().mockImplementation((id) => {
    coverages = coverages.filter((item) => item.id !== id)
    return Promise.resolve('Case insurance deleted successfully')
  })
  auths = [
    authorization({
      id: 'a1',
      caseId: 'c1',
      coverageId: 'cv1',
      insuranceName: '1003 – Aetna',
      number: 'UHC-2026-55120',
      used: 5,
    }),
    authorization({
      id: 'a2',
      caseId: 'c1',
      coverageId: 'cv1',
      insuranceName: '1003 – Aetna',
      number: 'BC-2026-90155',
    }),
  ]
  // The server's authorizations carry their insurance, not their case.
  listAuthsMock
    .mockReset()
    .mockImplementation(() => Promise.resolve(structuredClone(auths).map(({ caseId: _, ...auth }) => auth)))
  createAuthMock.mockReset().mockImplementation((payload) => {
    auths = [
      ...auths,
      authorization({
        id: 'a9',
        caseId: 'c1',
        // The test's coverage ids are not numbers: the one offered first.
        coverageId: 'cv1',
        number: payload.number,
        start: payload.start_date,
        end: payload.end_date,
        qty: payload.authorized_qty,
        unit: payload.unit,
      }),
    ]
    return Promise.resolve('Authorization created successfully')
  })
  updateAuthMock.mockReset().mockImplementation((id, payload) => {
    auths = auths.map((item) =>
      item.id === id
        ? {
            ...item,
            number: payload.number,
            start: payload.start_date,
            end: payload.end_date,
            qty: payload.authorized_qty,
            unit: payload.unit,
            remaining: payload.authorized_qty - item.used,
          }
        : item,
    )
    return Promise.resolve('Authorization updated successfully')
  })
  deleteAuthMock.mockReset().mockImplementation((id) => {
    auths = auths.filter((item) => item.id !== id)
    return Promise.resolve('Authorization deleted successfully')
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
    expect(await region('Insurance')).toBeInTheDocument()
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
    // The guarantor — their details on a quieter line under the name — and their address.
    const guarantor = await region('Guarantor')
    expect(within(guarantor).getByText('Claire Okonkwo')).toBeVisible()
    expect(within(guarantor).getByText('Spouse')).toBeVisible()
    expect(within(guarantor).getByText('140 Clinton Street')).toBeVisible()
    expect(within(guarantor).getByText('Brooklyn, NY 11201')).toBeVisible()
    // The notes are a group of their own; the IDs sit with the demographics.
    expect(within(await region('Internal notes')).getByText('Prefers morning visits.')).toBeVisible()
    expect(within(guarantor).queryByText('Prefers morning visits.')).not.toBeInTheDocument()
    expect(within(demographics).getByText('10412')).toBeVisible()
  }, 15_000) // The first render loads the whole one-page chart.

  it('jumps to a part of the chart from its menu, taking focus there', async () => {
    renderAt('/patients/p1')
    await region('Authorizations')
    const menu = screen.getByRole('navigation', { name: 'Patient chart' })
    await userEvent.click(within(menu).getByRole('link', { name: /^Authorizations/ }))
    expect(screen.getByRole('heading', { name: 'Authorizations' })).toHaveFocus()
    // The menu marks the part asked for, even one the page cannot scroll to its top.
    expect(within(menu).getByRole('link', { name: /^Authorizations/ })).toHaveAttribute(
      'aria-current',
      'location',
    )
    await userEvent.click(within(menu).getByRole('link', { name: /^Diagnoses/ }))
    expect(within(menu).getByRole('link', { name: /^Diagnoses/ })).toHaveAttribute('aria-current', 'location')
    await userEvent.click(within(menu).getByRole('link', { name: /^Insurance/ }))
    expect(screen.getByRole('heading', { name: 'Insurance' })).toHaveFocus()
    expect(within(menu).getByRole('link', { name: /^Insurance/ })).toHaveAttribute('aria-current', 'location')
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

  it('edits the patient on the server — an empty SSN is not sent, so the one on file stays', async () => {
    renderAt('/patients/p1')
    // "Edit patient" heads the Profile card: it edits all of its groups.
    await userEvent.click(within(await region('Profile')).getByRole('button', { name: 'Edit patient' }))
    const dialog = screen.getByRole('dialog', { name: 'Edit Nadia Okonkwo' })
    // The red asterisk marks what is required; explanations sit behind the info icons.
    expect(within(dialog).queryByText(/Required for billing/)).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'About SSN' })).toHaveAccessibleDescription(
      'Stored encrypted and shown masked. Left empty, the SSN on file is kept.',
    )
    const ssn = within(dialog).getByRole('textbox', { name: /^ssn/i })
    expect(ssn).toHaveValue('')
    expect(ssn).toHaveAttribute('placeholder', '***-**-7781 — enter a new value to replace')
    expect(within(dialog).queryByRole('combobox', { name: /practice/i })).not.toBeInTheDocument()
    expect(
      within(dialog)
        .getAllByRole('textbox', { name: /^first name/i })
        .at(-1),
    ).toHaveValue('Claire')

    const phone = within(dialog).getByRole('textbox', { name: /cell phone/i })
    await userEvent.clear(phone)
    await userEvent.type(phone, '718-555-0199')
    // The patient receives the statements from now on: the guarantor goes.
    await userEvent.click(within(dialog).getByRole('combobox', { name: /who receives statements/i }))
    await userEvent.click(screen.getByRole('option', { name: 'The patient' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save patient' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(updateMock).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ ssn: '', phoneCell: '718-555-0199', guarantorType: 'self' }),
    )
    // The chart reads the patient again from the server.
    expect(await within(await region('Contact & address')).findByText('718-555-0199')).toBeVisible()
    expect(within(await region('Guarantor')).getByText('The patient')).toBeVisible()
    expect(within(await region('Demographics')).getByText('***-**-7781')).toBeVisible()
    expect(toasts()).toEqual([expect.objectContaining({ title: 'Patient updated successfully' })])
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
    expect(setActiveMock).toHaveBeenCalledWith('p1', false)
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
    expect(deleteMock).toHaveBeenCalledWith('p1')
    expect(await screen.findByRole('table', { name: 'Patients' })).toHaveTextContent('Lin, Ada')
    expect(screen.queryByText(/Okonkwo/)).not.toBeInTheDocument()
    expect(toasts()).toEqual([expect.objectContaining({ title: 'Patient deleted successfully' })])
  })

  it('shows the case the server names for a patient — their “Default” case', async () => {
    renderAt('/patients/7')
    await region('Case details')
    expect(caseHeading('Default')).toHaveTextContent('Open')
  })

  it('keeps a case’s insurance on the case, not in the case form', async () => {
    renderAt('/patients/7')
    expect(await within(await region('Insurance')).findByText('No insurance on this case')).toBeVisible()
    await userEvent.click(within(await region('Case details')).getByRole('button', { name: 'Edit case' }))
    const dialog = screen.getByRole('dialog', { name: 'Edit case' })
    expect(within(dialog).queryByRole('combobox', { name: /primary insurance/i })).not.toBeInTheDocument()
    expect(within(dialog).queryByText('No insurance on file')).not.toBeInTheDocument()
  })

  it('says what to do first when the practice has no referring physicians', async () => {
    referrersMock.mockResolvedValue([])
    renderAt('/patients/7')
    await userEvent.click(within(await region('Case details')).getByRole('button', { name: 'Edit case' }))
    const dialog = screen.getByRole('dialog', { name: 'Edit case' })
    expect(await within(dialog).findByText('No referring physicians yet')).toBeVisible()
    expect(within(dialog).queryByRole('combobox', { name: /referring physician/i })).not.toBeInTheDocument()
    expect(within(dialog).getByRole('link', { name: 'Add a referring physician' })).toHaveAttribute(
      'href',
      '/setup/referring-physicians',
    )
  })

  it('says so for a patient that is not there', async () => {
    renderAt('/patients/nobody')
    expect(await screen.findByText('Patient not found', undefined, { timeout: 5000 })).toBeVisible()
  })
})

describe('the patient chart — the case’s Insurance', () => {
  it('lists the case’s insurances in priority order', async () => {
    renderAt('/patients/p1')
    const table = within(await region('Insurance')).getByRole('table', {
      name: 'Insurances of R shoulder 2026',
    })
    await within(table).findByText('1003 – Aetna')
    const [, aetna, medicare] = within(table).getAllByRole('row')
    expect(aetna).toHaveTextContent('Primary')
    expect(aetna).toHaveTextContent('1003 – Aetna')
    // The class and type say the same here: once. What the insurance asks of the case, as a tag.
    expect(aetna).toHaveTextContent('Commercial · Payer ID PAY3')
    expect(aetna).not.toHaveTextContent('Commercial · Commercial')
    expect(within(aetna as HTMLElement).getByText('Authorization required')).toBeVisible()
    // An empty group number is just empty: the server does not require one.
    expect(aetna).not.toHaveTextContent('Missing — required for billing')
    expect(aetna).toHaveTextContent('The patient (self)')
    expect(medicare).toHaveTextContent('Secondary')
    expect(medicare).toHaveTextContent('1001 – Medicare Part B')
  })

  it('removes an insurance from the case after asking', async () => {
    renderAt('/patients/p1')
    await region('Insurance')
    // A row's actions are the tables' icon buttons, named for the row.
    expect(await screen.findByRole('button', { name: 'Edit 1001 – Medicare Part B' })).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Delete 1001 – Medicare Part B' }))
    const confirm = screen.getByRole('alertdialog', { name: 'Delete this insurance?' })
    expect(
      within(confirm).getByText(
        'Medicare Part B is taken off R shoulder 2026, with the authorizations it issued.',
      ),
    ).toBeVisible()
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete insurance' }))
    await waitFor(() => expect(screen.queryByText('1001 – Medicare Part B')).not.toBeInTheDocument())
    expect(deleteCoverageMock).toHaveBeenCalledWith('cv2')
    expect(toasts()).toEqual([expect.objectContaining({ title: 'Case insurance deleted successfully' })])
  })

  it('adds an insurance — the claim number and subscriber as the insurance and relationship need', async () => {
    renderAt('/patients/p1')
    await region('Insurance')
    await userEvent.click(screen.getByRole('button', { name: 'Add insurance' }))
    const dialog = screen.getByRole('dialog', { name: 'Add insurance' })
    // The next free rank; the insurances already on the case are not offered again.
    expect(within(dialog).getByRole('combobox', { name: /^priority/i })).toHaveTextContent('Tertiary')
    await userEvent.click(within(dialog).getByRole('combobox', { name: /^insurance/i }))
    expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual([
      expect.stringContaining('Corvel Enterprise'),
      expect.stringContaining('GEICO No-Fault'),
    ])
    await userEvent.keyboard('{Escape}')
    expect(within(dialog).queryByRole('textbox', { name: /employer name/i })).not.toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Add insurance' }))
    expect(await within(dialog).findByText('Select an insurance.')).toBeVisible()
    expect(within(dialog).getByText('Enter the member ID.')).toBeVisible()
    // The group number is not the server's to require.
    expect(within(dialog).queryByText('Enter the group number.')).not.toBeInTheDocument()

    // Workers' Comp: a claim number, and room for the employer.
    await userEvent.click(within(dialog).getByRole('combobox', { name: /^insurance/i }))
    await userEvent.click(await screen.findByRole('option', { name: /Corvel Enterprise/ }))
    expect(within(dialog).getByRole('textbox', { name: /employer name/i })).toBeInTheDocument()
    // Someone else is the subscriber: their names.
    await userEvent.click(within(dialog).getByRole('combobox', { name: /^relationship/i }))
    await userEvent.click(screen.getByRole('option', { name: 'Spouse' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add insurance' }))
    expect(await within(dialog).findByText('Enter the claim number.')).toBeVisible()
    expect(within(dialog).getByText('Enter the subscriber’s first name.')).toBeVisible()
    expect(within(dialog).getByText('Enter the subscriber’s last name.')).toBeVisible()

    await userEvent.type(within(dialog).getByRole('textbox', { name: /member id/i }), 'WC-4417260')
    await userEvent.type(within(dialog).getByRole('textbox', { name: /claim number/i }), '1439WC260300330')
    await userEvent.type(within(dialog).getByRole('textbox', { name: /^first name/i }), 'Chidi')
    await userEvent.type(within(dialog).getByRole('textbox', { name: /^last name/i }), 'Okonkwo')
    await userEvent.type(within(dialog).getByRole('textbox', { name: /subscriber dob/i }), '03/02/1982')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add insurance' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(createCoverageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        case_id: Number.NaN,
        insurance_id: 5,
        rank: 3,
        member_id: 'WC-4417260',
        claim_number: '1439WC260300330',
        subscriber: {
          first_name: 'Chidi',
          last_name: 'Okonkwo',
          relationship: 'Spouse',
          date_of_birth: '1982-03-02',
          gender: null,
        },
        employer: null,
      }),
    )
    expect(toasts()).toEqual([expect.objectContaining({ title: 'Case insurance created successfully' })])
  }, 25_000)

  it('edits an insurance — its insurance fixed — on the server', async () => {
    renderAt('/patients/p1')
    await region('Insurance')
    await userEvent.click(await screen.findByRole('button', { name: 'Edit 1003 – Aetna' }))
    const dialog = screen.getByRole('dialog', { name: 'Edit insurance' })
    expect(within(dialog).getByRole('combobox', { name: /^insurance/i })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    const member = within(dialog).getByRole('textbox', { name: /member id/i })
    await userEvent.clear(member)
    await userEvent.type(member, 'W999')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save insurance' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(updateCoverageMock).toHaveBeenCalledWith(
      'cv1',
      expect.objectContaining({ member_id: 'W999', rank: 1 }),
    )
    expect(updateCoverageMock.mock.calls[0]?.[1]).not.toHaveProperty('insurance_id')
  })

  it('says what is needed first when the practice has no insurance', async () => {
    insurancesMock.mockReset().mockResolvedValue([])
    renderAt('/patients/p1')
    await region('Insurance')
    await waitFor(() => expect(insurancesMock).toHaveBeenCalled())
    await userEvent.click(screen.getByRole('button', { name: 'Add insurance' }))
    const dialog = await screen.findByRole('dialog', { name: 'Cannot add insurance yet' })
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
    expect(await within(details).findByText('Priya Natarajan, MD')).toBeVisible()
    expect(within(details).getByText('Referring (DN) · NPI 1720394851')).toBeVisible()
    expect(within(await region('Insurance')).getByText('1003 – Aetna')).toBeVisible()
    expect(within(await region('Insurance')).getByText(/Authorization required/)).toBeVisible()
    const diagnoses = within(await region('Diagnoses')).getByRole('list', { name: 'Diagnoses' })
    expect(
      within(diagnoses)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([expect.stringContaining('M75.101'), expect.stringContaining('M25.511')])
    expect(
      within(await region('Authorizations')).getByText('Required by the primary insurance'),
    ).toBeVisible()
    expect(router.state.location.search).toEqual({})

    // Switching case: the other case, with what billing still needs.
    await pickCase(/Neck pain/)
    await waitFor(() => expect(router.state.location.search).toEqual({ case: 'c2' }))
    const other = await region('Case details')
    expect(caseHeading('Neck pain')).toBeInTheDocument()
    expect(within(other).getAllByText('Required for billing').length).toBeGreaterThan(0)
    expect(within(await region('Insurance')).getByText('No insurance on this case')).toBeVisible()
  })

  it('edits the case on the server with its checks — the accident state follows an auto accident', async () => {
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

    // The prototype's employment status is not in the case contract.
    expect(within(dialog).queryByRole('textbox', { name: /employment status/i })).not.toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('combobox', { name: /related cause/i }))
    expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual([
      'Employment Related',
      'Auto Accident',
      'Other',
    ])
    await userEvent.click(screen.getByRole('option', { name: 'Auto Accident' }))
    expect(within(dialog).getByRole('textbox', { name: /accident state/i })).toBeEnabled()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save case' }))
    expect(await within(dialog).findByText('Enter the accident state.')).toBeVisible()
    // The physician and the injury date are the server's to want: not required here.
    expect(within(dialog).queryByText('Select the referring physician.')).not.toBeInTheDocument()
    expect(within(dialog).queryByText('Enter the injury or onset date.')).not.toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('combobox', { name: /referring physician/i }))
    await userEvent.click(await screen.findByRole('option', { name: /Thomas Beckett/ }))
    await userEvent.type(within(dialog).getByRole('textbox', { name: /injury \/ onset date/i }), '08/09/2026')
    await userEvent.type(within(dialog).getByRole('textbox', { name: /accident state/i }), 'ny')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save case' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(updateCaseMock).toHaveBeenCalledWith(
      'c2',
      expect.objectContaining({ injury_type: 'auto', accident_state: 'NY' }),
    )
    const details = await region('Case details')
    expect(await within(details).findByText(/Thomas Beckett, MD/)).toBeVisible()
    expect(within(details).getByText('Auto Accident')).toBeVisible()
    expect(within(details).getByText('08/09/2026')).toBeVisible()
    expect(within(details).getByText('NY')).toBeVisible()
    expect(toasts()).toEqual([expect.objectContaining({ title: 'Patient case updated successfully' })])
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
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create case' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(createCaseMock).toHaveBeenCalledWith(
      expect.objectContaining({ patient_id: Number.NaN, name: 'L knee 2026', referring_physician_id: 1 }),
    )
    // Found by its name — the server returns no id — and chosen on the chart.
    await waitFor(() => expect(caseHeading('L knee 2026')).toBeInTheDocument())
    // A server id travels as a number: ?case=41.
    expect(router.state.location.search).toEqual({ case: 41 })
    expect(caseCard()).toHaveAccessibleName('Case: L knee 2026. Switch case or add a new one')
    expect(await within(await region('Insurance')).findByText('No insurance on this case')).toBeVisible()
    expect(toasts()).toEqual([expect.objectContaining({ title: 'Patient case created successfully' })])
  })

  it('adds, edits and deletes diagnoses on the server — in the order added, the position is the pointer', async () => {
    renderAt('/patients/p1')
    const section = await region('Diagnoses')
    const order = () =>
      within(within(section).getByRole('list', { name: 'Diagnoses' }))
        .getAllByRole('listitem')
        .map((item) => item.textContent?.match(/[A-Z]\d{2}\.\w+/)?.[0])
    expect(within(section).getByText('Rotator cuff tear, right shoulder')).toBeVisible()

    await userEvent.click(within(section).getByRole('button', { name: 'Add diagnosis' }))
    const dialog = screen.getByRole('dialog', { name: 'Add diagnosis' })
    expect(within(dialog).getByText('Pointer 3 of 12.')).toBeVisible()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add diagnosis' }))
    expect(await within(dialog).findByText('Enter an ICD-10 code.')).toBeVisible()
    // Typed in capitals, as the server keeps it.
    await userEvent.type(within(dialog).getByRole('textbox', { name: /icd-10 code/i }), 'm54.2')
    await userEvent.type(within(dialog).getByRole('textbox', { name: /description/i }), 'Cervicalgia')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add diagnosis' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(createDiagnosisMock).toHaveBeenLastCalledWith({
      // The case's id as a number — 'c1' here, so NaN.
      case_id: Number.NaN,
      icd10_code: 'M54.2',
      description: 'Cervicalgia',
    })
    expect(toasts()).toEqual([expect.objectContaining({ title: 'Case diagnosis created successfully' })])
    await waitFor(() => expect(order()).toEqual(['M75.101', 'M25.511', 'M54.2']))
    // No moving: the server keeps no position.
    expect(within(section).queryByRole('button', { name: /^Move/ })).not.toBeInTheDocument()

    await userEvent.click(within(section).getByRole('button', { name: 'Edit diagnosis M25.511' }))
    const editing = screen.getByRole('dialog', { name: 'Edit diagnosis' })
    expect(within(editing).getByText('Pointer 2 of 12.')).toBeVisible()
    expect(within(editing).getByRole('textbox', { name: /icd-10 code/i })).toHaveValue('M25.511')
    await userEvent.type(
      within(editing).getByRole('textbox', { name: /description/i }),
      'Right shoulder pain',
    )
    await userEvent.click(within(editing).getByRole('button', { name: 'Save diagnosis' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(updateDiagnosisMock).toHaveBeenLastCalledWith('2', {
      icd10_code: 'M25.511',
      description: 'Right shoulder pain',
    })
    expect(await within(section).findByText('Right shoulder pain')).toBeVisible()

    await userEvent.click(within(section).getByRole('button', { name: 'Delete diagnosis M75.101' }))
    const confirm = screen.getByRole('alertdialog', { name: 'Delete diagnosis M75.101?' })
    expect(
      within(confirm).getByText(
        'It is taken off this case; pointers after it move up by one. Visits already recorded keep their own codes.',
      ),
    ).toBeVisible()
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete diagnosis' }))
    expect(deleteDiagnosisMock).toHaveBeenLastCalledWith('1')
    await waitFor(() => expect(order()).toEqual(['M25.511', 'M54.2']))
  })

  it('shows the server’s refusals of a diagnosis: on the code, or above the form', async () => {
    createDiagnosisMock
      .mockRejectedValueOnce(
        new ApiError({
          kind: 'validation',
          message: 'This diagnosis is already on the case.',
          serverMessage: 'This diagnosis is already on the case.',
          status: 422,
          fieldErrors: [{ path: 'code', message: 'This diagnosis is already on the case.' }],
        }),
      )
      .mockRejectedValueOnce(
        new ApiError({
          kind: 'validation',
          message: 'A case can have at most 12 diagnosis codes.',
          serverMessage: 'A case can have at most 12 diagnosis codes.',
          status: 422,
          fieldErrors: [],
        }),
      )
    renderAt('/patients/p1')
    const section = await region('Diagnoses')
    await userEvent.click(within(section).getByRole('button', { name: 'Add diagnosis' }))
    const dialog = screen.getByRole('dialog', { name: 'Add diagnosis' })
    await userEvent.type(within(dialog).getByRole('textbox', { name: /icd-10 code/i }), 'M25.511')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add diagnosis' }))
    expect(await within(dialog).findByText('This diagnosis is already on the case.')).toBeVisible()
    expect(within(dialog).getByRole('textbox', { name: /icd-10 code/i })).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add diagnosis' }))
    expect(await within(dialog).findByText('A case can have at most 12 diagnosis codes.')).toBeVisible()
    expect(screen.getByRole('dialog', { name: 'Add diagnosis' })).toBeInTheDocument()
  })

  it('lists the case’s authorizations as the server counts them', async () => {
    renderAt('/patients/p1')
    const section = await region('Authorizations')
    const table = within(section).getByRole('table', { name: 'Authorizations of R shoulder 2026' })
    const row = within(table).getByRole('row', { name: /UHC-2026-55120/ })
    // The issuing insurance as the server names it, its priority on the case.
    expect(row).toHaveTextContent('1003 – Aetna')
    expect(row).toHaveTextContent('Primary')
    expect(row).toHaveTextContent('12 visits')
    // Used and left: the server's counts.
    expect(
      within(row)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(expect.arrayContaining(['5', '7']))
  })

  it('adds an authorization to the server’s rules, with the server’s refusals on the fields', async () => {
    createAuthMock.mockRejectedValueOnce(
      new ApiError({
        kind: 'validation',
        message: 'This authorization number is already on this insurance.',
        serverMessage: 'This authorization number is already on this insurance.',
        status: 422,
        fieldErrors: [{ path: 'number', message: 'This authorization number is already on this insurance.' }],
      }),
    )
    renderAt('/patients/p1')
    const section = await region('Authorizations')
    await userEvent.click(within(section).getByRole('button', { name: 'Add authorization' }))
    const dialog = screen.getByRole('dialog', { name: 'Add authorization' })
    expect(within(dialog).getByRole('combobox', { name: /issued by/i })).toHaveTextContent(
      '1003 – Aetna (primary)',
    )
    await userEvent.type(within(dialog).getByRole('textbox', { name: /authorization number/i }), '0VJL671TT')
    await userEvent.type(within(dialog).getByRole('textbox', { name: /start date/i }), '09/01/2026')
    await userEvent.type(within(dialog).getByRole('textbox', { name: /end date/i }), '08/01/2026')
    await userEvent.type(within(dialog).getByRole('spinbutton', { name: /approved/i }), '10000')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add authorization' }))
    expect(await within(dialog).findByText('Enter an end date on or after the start date.')).toBeVisible()
    expect(within(dialog).getByText('Enter a whole number from 1 to 9999.')).toBeVisible()
    expect(createAuthMock).not.toHaveBeenCalled()

    const end = within(dialog).getByRole('textbox', { name: /end date/i })
    await userEvent.clear(end)
    await userEvent.type(end, '09/01/2026')
    const qty = within(dialog).getByRole('spinbutton', { name: /approved/i })
    await userEvent.clear(qty)
    await userEvent.type(qty, '6')
    // The server's refusal lands on its field; the dialog stays open.
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add authorization' }))
    expect(
      await within(dialog).findByText('This authorization number is already on this insurance.'),
    ).toBeVisible()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Add authorization' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    // (The test's coverage ids are not numbers; the server's are.)
    expect(createAuthMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        number: '0VJL671TT',
        start_date: '2026-09-01',
        end_date: '2026-09-01',
        authorized_qty: 6,
        unit: 'visits',
      }),
    )
    expect(await within(section).findByText('0VJL671TT')).toBeInTheDocument()
    expect(toasts().at(-1)).toEqual(expect.objectContaining({ title: 'Authorization created successfully' }))
  }, 20_000)

  it('edits an authorization — its insurance stays — with the server’s message when it refuses', async () => {
    updateAuthMock.mockRejectedValueOnce(
      new ApiError({
        kind: 'validation',
        message: 'The end date must be on or after the start date.',
        serverMessage: 'The end date must be on or after the start date.',
        status: 422,
      }),
    )
    renderAt('/patients/p1')
    const section = await region('Authorizations')
    await userEvent.click(within(section).getByRole('button', { name: 'Edit authorization BC-2026-90155' }))
    const dialog = screen.getByRole('dialog', { name: 'Edit authorization' })
    expect(within(dialog).getByRole('combobox', { name: /issued by/i })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    const number = within(dialog).getByRole('textbox', { name: /authorization number/i })
    expect(number).toHaveValue('BC-2026-90155')
    await userEvent.clear(number)
    await userEvent.type(number, 'BC-2026-90156')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save authorization' }))
    expect(await within(dialog).findByText('The end date must be on or after the start date.')).toBeVisible()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Save authorization' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    // No insurance on a save: the server refuses one.
    expect(updateAuthMock).toHaveBeenLastCalledWith('a2', {
      number: 'BC-2026-90156',
      start_date: '2026-08-01',
      end_date: '2099-10-31',
      authorized_qty: 12,
      unit: 'visits',
    })
    expect(await within(section).findByText('BC-2026-90156')).toBeInTheDocument()
    expect(toasts().at(-1)).toEqual(expect.objectContaining({ title: 'Authorization updated successfully' }))
  }, 20_000)

  it('deletes an authorization after asking, in the server’s words', async () => {
    deleteAuthMock.mockRejectedValueOnce(
      new ApiError({
        kind: 'validation',
        message: 'This authorization has been used by visits.',
        serverMessage: 'This authorization has been used by visits.',
        status: 422,
      }),
    )
    renderAt('/patients/p1')
    const section = await region('Authorizations')
    const confirmDelete = async (number: string) => {
      await userEvent.click(within(section).getByRole('button', { name: `Delete authorization ${number}` }))
      await userEvent.click(
        within(screen.getByRole('alertdialog', { name: `Delete authorization ${number}?` })).getByRole(
          'button',
          { name: 'Delete authorization' },
        ),
      )
    }
    // Whether a used one can go is the server's to say.
    await confirmDelete('UHC-2026-55120')
    await waitFor(() =>
      expect(toasts().at(-1)).toEqual(
        expect.objectContaining({
          tone: 'error',
          title: 'Authorization UHC-2026-55120 was not deleted',
          description: 'This authorization has been used by visits.',
        }),
      ),
    )
    expect(within(section).getByText('UHC-2026-55120')).toBeInTheDocument()

    await confirmDelete('BC-2026-90155')
    await waitFor(() => expect(within(section).queryByText('BC-2026-90155')).not.toBeInTheDocument())
    expect(deleteAuthMock).toHaveBeenLastCalledWith('a2')
    expect(toasts().at(-1)).toEqual(expect.objectContaining({ title: 'Authorization deleted successfully' }))
  })
})
