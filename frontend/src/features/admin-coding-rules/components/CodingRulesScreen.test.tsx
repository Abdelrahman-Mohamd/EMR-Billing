import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
import { useToastStore } from '@/stores/toast-store'
import { createTestQueryClient, renderWithProviders } from '@/test/render'
import { ApiError } from '@/lib/api/api-error'
import type { Insurance } from '@/features/admin-insurances'
import type { Practice } from '@/features/admin-practices'
import type { ProcedureCode } from '@/features/admin-procedure-codes'
import {
  createCodingRule,
  deleteCodingRule,
  listCodingRules,
  previewCodingRule,
  setCodingRuleActive,
  updateCodingRule,
} from '../api/coding-rules-api'
import type { CodingRule } from '../model/coding-rule'

// The coding rules are the server's: faked at their api, answering as it does.
// The practices, insurances and procedure codes are other features'
// integration points: faked by path, never imported (lint forbids it).
vi.mock('../api/coding-rules-api', () => ({
  listCodingRules: vi.fn(),
  createCodingRule: vi.fn(),
  updateCodingRule: vi.fn(),
  setCodingRuleActive: vi.fn(),
  deleteCodingRule: vi.fn(),
  previewCodingRule: vi.fn(),
}))
const previewMock = vi.mocked(previewCodingRule)
const listMock = vi.mocked(listCodingRules)
const createMock = vi.mocked(createCodingRule)
const updateMock = vi.mocked(updateCodingRule)
const setActiveMock = vi.mocked(setCodingRuleActive)
const deleteMock = vi.mocked(deleteCodingRule)
let rules: CodingRule[]

const practicesMock = vi.hoisted(() => vi.fn<() => Promise<Practice[]>>())
const insurancesMock = vi.hoisted(() => vi.fn<() => Promise<Insurance[]>>())
const codesMock = vi.hoisted(() => vi.fn<() => ProcedureCode[]>())
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
vi.mock('@/features/admin-procedure-codes/api/procedure-codes-api', () => ({
  listProcedureCodes: () => Promise.resolve(codesMock()),
}))

const practice = (id: number, name: string): Practice => ({
  id,
  organizationId: null,
  code: `P${id}`,
  name,
  dbaName: undefined,
  npi: '1609847312',
  taxId: '84-2217765',
  taxonomyCode: '225100000X',
  address: { line1: '1 Main Street', city: 'Brooklyn', state: 'NY', zip: '11209' },
  isActive: true,
  locations: [],
})
// Only what coding rules read; the rest of an insurance does not matter here.
const insurance = (id: number, practiceId: number, name: string) =>
  ({ id, practiceId, insuranceClassId: 1, code: id, name, isActive: true }) as Insurance
const INSURANCES = [
  insurance(1, 1, 'Medicare Part B'),
  insurance(4, 1, 'UnitedHealthcare'),
  insurance(9, 2, 'Northgate Medicare'),
]
const code = (id: number, value: string, description: string) =>
  ({ id, code: value, description, isActive: true }) as ProcedureCode
const CODES = [
  code(10, '97010', 'Hot or cold packs'),
  code(14, '97014', 'Electrical stimulation, unattended'),
  code(35, '97035', 'Ultrasound therapy'),
  code(283, 'G0283', 'Electrical stimulation, unattended (Medicare)'),
]
const codeOf = (id: number | null) => CODES.find((item) => item.id === id)?.code ?? ''

const rule = (
  overrides: Partial<CodingRule> & Pick<CodingRule, 'id' | 'practiceId' | 'fromCodeId'>,
): CodingRule => {
  const scope = overrides.scope ?? { kind: 'default' }
  return {
    type: 'Drop',
    fromCode: codeOf(overrides.fromCodeId),
    toCodeId: null,
    toCode: codeOf(overrides.toCodeId ?? null),
    scope,
    insuranceName:
      scope.kind === 'insurance'
        ? (INSURANCES.find((item) => item.id === scope.insuranceId)?.name ?? '')
        : '',
    note: '',
    isActive: true,
    ...overrides,
  }
}

beforeEach(() => {
  practicesMock
    .mockReset()
    .mockResolvedValue([practice(1, 'Harborline Physical Therapy'), practice(2, 'Northgate')])
  insurancesMock.mockReset().mockResolvedValue(INSURANCES)
  codesMock.mockReset().mockReturnValue(CODES)
  rules = [
    rule({
      id: 1,
      practiceId: 1,
      type: 'Replace',
      fromCodeId: 14,
      toCodeId: 283,
      scope: { kind: 'insurance', insuranceId: 1 },
      note: 'Medicare requires G0283 for unattended e-stim.',
    }),
    rule({ id: 2, practiceId: 1, fromCodeId: 10, note: 'Hot/cold packs are bundled for most payers.' }),
    rule({
      id: 3,
      practiceId: 2,
      type: 'Replace',
      fromCodeId: 14,
      toCodeId: 283,
      scope: { kind: 'insurance', insuranceId: 9 },
    }),
    rule({
      id: 4,
      practiceId: 1,
      fromCodeId: 35,
      scope: { kind: 'insurance', insuranceId: 4 },
      isActive: false,
    }),
  ]
  listMock
    .mockReset()
    .mockImplementation((practiceId) =>
      Promise.resolve(structuredClone(rules.filter((item) => item.practiceId === practiceId))),
    )
  // A rule as the server saves it: its codes and insurance named.
  const saved = (id: number, practiceId: number, payload: Parameters<typeof updateCodingRule>[1]) =>
    rule({
      id,
      practiceId,
      type: payload.action === 'replace' ? 'Replace' : 'Drop',
      fromCodeId: payload.procedure_code_id,
      toCodeId: payload.replacement_code_id,
      scope:
        payload.insurance_id === null
          ? { kind: 'default' }
          : { kind: 'insurance', insuranceId: payload.insurance_id },
      note: payload.notes ?? '',
    })
  createMock.mockReset().mockImplementation(({ practice_id: practiceId, ...payload }) => {
    rules = [...rules, saved(10 + rules.length, practiceId, payload)]
    return Promise.resolve('Coding rule created successfully')
  })
  updateMock.mockReset().mockImplementation((id, payload) => {
    rules = rules.map((item) =>
      item.id === id ? { ...saved(id, item.practiceId, payload), isActive: item.isActive } : item,
    )
    return Promise.resolve('Coding rule updated successfully')
  })
  setActiveMock.mockReset().mockImplementation((id, isActive) => {
    rules = rules.map((item) => (item.id === id ? { ...item, isActive } : item))
    return Promise.resolve('Coding rule updated successfully')
  })
  previewMock.mockReset().mockImplementation(({ insuranceId, procedureCodeId }) => {
    const acting = rules.find(
      (item) =>
        item.isActive &&
        item.fromCodeId === procedureCodeId &&
        item.scope.kind === 'insurance' &&
        item.scope.insuranceId === insuranceId,
    )
    return Promise.resolve(
      acting === undefined
        ? { message: 'No rule applies: the code is billed as entered', rule: null }
        : {
            message: `${acting.type} ${acting.fromCode}${acting.type === 'Replace' ? ` with ${acting.toCode}` : ''} for ${acting.insuranceName}`,
            rule: structuredClone(acting),
          },
    )
  })
  deleteMock.mockReset().mockImplementation((id) => {
    rules = rules.filter((item) => item.id !== id)
    return Promise.resolve('Coding rule deleted successfully')
  })
})
afterEach(() => {
  useToastStore.getState().clear()
})

function renderAt(path = '/admin/coding-rules') {
  const queryClient = createTestQueryClient()
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { queryClient },
  })
  renderWithProviders(<RouterProvider router={router} />, { queryClient })
  return router
}

const table = (name = 'Harborline Physical Therapy') =>
  screen.findByRole('table', { name: `Coding rules of ${name}` }, { timeout: 5000 })
const rowOf = (target: HTMLElement, text: string) =>
  within(target)
    .getAllByRole('row')
    .find((row) => row.textContent?.includes(text)) as HTMLElement
const dataRows = (target: HTMLElement) => within(target).getAllByRole('row').slice(1)

async function openNew() {
  await table()
  await userEvent.click(screen.getByRole('button', { name: 'New rule' }))
  return screen.getByRole('dialog', { name: 'New coding rule' })
}
async function openTester() {
  await userEvent.click(screen.getByRole('button', { name: 'Test the rules' }))
  return screen.getByRole('dialog', { name: 'Test the rules' })
}
async function pick(dialog: HTMLElement, field: RegExp, option: string | RegExp) {
  await userEvent.click(within(dialog).getByRole('combobox', { name: field }))
  await userEvent.click(await screen.findByRole('option', { name: option }))
}

describe('Admin → Coding rules', () => {
  it('lists the default rules and the practice’s own, as the prototype does', async () => {
    renderAt()
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Coding rules' }, { timeout: 5000 }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Replace or drop a CPT / HCPCS code for an insurance: the rule changes a visit’s charge lines when it is released.',
      ),
    ).toBeVisible()
    const rules = await table()
    // Northgate's rule belongs to another practice.
    expect(listMock).toHaveBeenCalledWith(1, expect.anything())
    expect(dataRows(rules)).toHaveLength(3)
    const medicare = rowOf(rules, 'Medicare requires')
    expect(medicare).toHaveTextContent('97014 → G0283')
    expect(medicare).toHaveTextContent('Medicare Part B only')
    const bundled = rowOf(rules, 'Hot/cold')
    expect(bundled).toHaveTextContent('97010 → dropped')
    expect(bundled).toHaveTextContent('Default (all payers)')
    expect(within(rowOf(rules, '97035')).getByRole('switch')).toHaveAttribute('aria-checked', 'false')
    // When rules run is the header's to say; the list's footer counts them.
    expect(
      screen.getByText('3 rules · active rules change a visit’s charge lines when it is released'),
    ).toBeVisible()
    expect(screen.queryByText(/backend|not saved|temporary|demo|coming soon|mock/i)).not.toBeInTheDocument()
  })

  it('shows another practice’s rules from the header picker, kept in the URL', async () => {
    const router = renderAt()
    await table()
    await userEvent.click(screen.getByRole('combobox', { name: 'Practice' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Northgate' }))
    const rules = await table('Northgate')
    expect(router.state.location.search).toEqual({ practice: 2 })
    // Asked of the server by practice: a default rule is its practice's own.
    expect(listMock).toHaveBeenLastCalledWith(2, expect.anything())
    expect(dataRows(rules)).toHaveLength(1)
    expect(rowOf(rules, 'G0283')).toHaveTextContent('Northgate Medicare only')
  })

  it('pauses and resumes a rule with its switch', async () => {
    renderAt()
    const rules = await table()
    const toggle = within(rowOf(rules, 'Hot/cold')).getByRole('switch', {
      name: 'Drop 97010, Default (all payers): active',
    })
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(toggle)
    // Asks first; cancelling changes nothing.
    await userEvent.click(
      within(await screen.findByRole('alertdialog', { name: 'Deactivate Rule Drop 97010?' })).getByRole(
        'button',
        {
          name: 'Cancel',
        },
      ),
    )
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(toggle)
    // Asks first.
    await userEvent.click(
      within(await screen.findByRole('alertdialog', { name: /^(Deactivate|Reactivate) / })).getByRole(
        'button',
        {
          name: /^(Deactivate|Reactivate)$/,
        },
      ),
    )
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'false'))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    await userEvent.click(toggle)
    // Asks first.
    await userEvent.click(
      within(await screen.findByRole('alertdialog', { name: /^(Deactivate|Reactivate) / })).getByRole(
        'button',
        {
          name: /^(Deactivate|Reactivate)$/,
        },
      ),
    )
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'))
    expect(setActiveMock.mock.calls).toEqual([
      [2, false],
      [2, true],
    ])
    // Each change says so, in the server's words.
    expect(useToastStore.getState().toasts.map((toast) => toast.tone)).toEqual(['success', 'success'])
  })

  it('creates a Replace rule for an insurance, with the prototype’s checks', async () => {
    renderAt()
    const dialog = await openNew()
    // Rule type is a dropdown, Replace by default; each choice says what it does.
    const ruleType = within(dialog).getByRole('combobox', { name: /rule type/i })
    expect(ruleType).toHaveTextContent('Replace')
    await userEvent.click(ruleType)
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'ReplaceConvert a code to an alternative code.',
      'DropRemove the code from the claim.',
    ])
    await userEvent.keyboard('{Escape}')
    expect(within(dialog).getByRole('button', { name: 'About Applies to' })).toHaveAccessibleDescription(
      'Each rule belongs to one insurance of the practice.',
    )

    await userEvent.click(within(dialog).getByRole('button', { name: 'Save rule' }))
    expect(await within(dialog).findByText('Select a code.')).toBeVisible()
    expect(within(dialog).getByText('Select the code to replace it with.')).toBeVisible()
    // Every rule is an insurance's (since 2026-10-22): none is picked for you.
    expect(within(dialog).getByText('Select the insurance it applies to.')).toBeVisible()

    await pick(dialog, /^code/i, /^97014/)
    await pick(dialog, /replace with/i, /^97014/)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save rule' }))
    expect(await within(dialog).findByText('Please choose a different code.')).toBeVisible()

    await pick(dialog, /replace with/i, /^G0283/)
    // Applies to: the practice's insurances, and nothing else — no default, no class.
    await userEvent.click(within(dialog).getByRole('combobox', { name: /applies to/i }))
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Medicare Part B',
      'UnitedHealthcare',
    ])
    await userEvent.click(screen.getByRole('option', { name: 'UnitedHealthcare' }))
    await userEvent.type(within(dialog).getByRole('textbox', { name: /why/i }), 'UHC contract')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save rule' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(createMock).toHaveBeenCalledWith({
      practice_id: 1,
      action: 'replace',
      procedure_code_id: 14,
      replacement_code_id: 283,
      insurance_id: 4,
      notes: 'UHC contract',
    })
    const added = rowOf(await table(), 'UHC contract')
    expect(added).toHaveTextContent('97014 → G0283')
    expect(added).toHaveTextContent('UnitedHealthcare only')
    expect(within(added).getByRole('switch')).toHaveAttribute('aria-checked', 'true')
    expect(useToastStore.getState().toasts).toEqual([
      expect.objectContaining({
        tone: 'success',
        title: 'Coding rule created successfully',
        description: 'It runs when a visit is released.',
      }),
    ])
  })

  it('creates a Drop rule: no replacement needed', async () => {
    renderAt()
    const dialog = await openNew()
    await pick(dialog, /rule type/i, /^Drop/)
    expect(within(dialog).getByRole('combobox', { name: /replace with/i })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    await pick(dialog, /^code/i, /^97035/)
    await pick(dialog, /applies to/i, 'Medicare Part B')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save rule' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'drop',
        procedure_code_id: 35,
        replacement_code_id: null,
        insurance_id: 1,
      }),
    )
    const list = await table()
    await waitFor(() => expect(dataRows(list)).toHaveLength(4))
    const added = dataRows(list).at(-1) as HTMLElement
    expect(added).toHaveTextContent('97035 → dropped')
    expect(added).toHaveTextContent('Medicare Part B only')
  })

  it('shows the server’s refusal on the field it names', async () => {
    createMock.mockRejectedValueOnce(
      new ApiError({
        kind: 'validation',
        message: 'This payer already has a rule for this code.',
        serverMessage: 'This payer already has a rule for this code.',
        status: 422,
        fieldErrors: [{ path: 'fromCode', message: 'This payer already has a rule for this code.' }],
      }),
    )
    renderAt()
    const dialog = await openNew()
    await pick(dialog, /rule type/i, /^Drop/)
    await pick(dialog, /^code/i, /^97014/)
    await pick(dialog, /applies to/i, 'Medicare Part B')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save rule' }))
    expect(await within(dialog).findByText('This payer already has a rule for this code.')).toBeVisible()
    expect(screen.getByRole('dialog', { name: 'New coding rule' })).toBeInTheDocument()
  })

  it('edits a rule — one from before, with no insurance, is given one', async () => {
    renderAt()
    const rules = await table()
    await userEvent.click(
      within(rowOf(rules, 'Hot/cold')).getByRole('button', { name: 'Edit rule Drop 97010' }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Edit coding rule' })
    expect(within(dialog).getByRole('combobox', { name: /rule type/i })).toHaveTextContent('Drop')
    expect(within(dialog).getByRole('textbox', { name: /why/i })).toHaveValue(
      'Hot/cold packs are bundled for most payers.',
    )
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save rule' }))
    expect(await within(dialog).findByText('Select the insurance it applies to.')).toBeVisible()
    await pick(dialog, /applies to/i, 'Medicare Part B')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save rule' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(updateMock).toHaveBeenCalledWith(2, {
      action: 'drop',
      procedure_code_id: 10,
      replacement_code_id: null,
      insurance_id: 1,
      notes: 'Hot/cold packs are bundled for most payers.',
    })
    await waitFor(() => expect(rowOf(rules, 'Hot/cold')).toHaveTextContent('Medicare Part B only'))
  })

  it('deletes a rule after asking', async () => {
    renderAt()
    const rules = await table()
    await userEvent.click(
      within(rowOf(rules, 'Hot/cold')).getByRole('button', { name: 'Delete rule Drop 97010' }),
    )
    const confirm = screen.getByRole('alertdialog', { name: 'Delete this rule?' })
    expect(within(confirm).getByText('Drop 97010 will no longer run during scrubbing.')).toBeVisible()
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete rule' }))
    await waitFor(() => expect(within(rules).queryByText(/Hot\/cold/)).not.toBeInTheDocument())
    expect(dataRows(rules)).toHaveLength(2)
    expect(deleteMock).toHaveBeenCalledWith(2)
    expect(useToastStore.getState().toasts).toEqual([
      expect.objectContaining({ tone: 'success', title: 'Coding rule deleted successfully' }),
    ])
  })

  it('tests the rules on the server: each code’s answer in its words, and the claim after', async () => {
    renderAt()
    await table()
    const tester = await openTester()
    expect(
      within(tester).getByText('See what the active rules do to the codes on a claim for one payer.'),
    ).toBeVisible()
    expect(
      within(tester).getByText('Choose the codes on a claim to see what the rules do to them.'),
    ).toBeVisible()

    // Codes are picked, not typed: each with its description in the list.
    await userEvent.click(within(tester).getByRole('combobox', { name: 'Codes on the claim' }))
    expect(
      await screen.findByRole('option', { name: /97014.*Electrical stimulation, unattended/ }),
    ).toBeVisible()
    for (const code of ['97035', '97014', '97010'])
      await userEvent.click(screen.getByRole('option', { name: new RegExp(`^${code}`) }))
    await userEvent.keyboard('{Escape}')

    const items = () =>
      within(within(tester).getByRole('list', { name: 'What the rules do' })).getAllByRole('listitem')
    // In the list's order, as the chips show them; every answer is the server's.
    await waitFor(() =>
      expect(items()[0]).toHaveTextContent('No rule applies: the code is billed as entered'),
    )
    expect(items().map((item) => item.textContent)).toEqual([
      '97010No rule applies: the code is billed as entered',
      '97014 →  becomes G0283Replace 97014 with G0283 for Medicare Part BMedicare requires G0283 for unattended e-stim.',
      '97035No rule applies: the code is billed as entered',
    ])
    expect(previewMock).toHaveBeenCalledWith(
      { practiceId: 1, insuranceId: 1, procedureCodeId: 14 },
      expect.anything(),
    )
    expect(tester).toHaveTextContent('Claim after the rules97010 · G0283 · 970351 of 3 codes changed.')

    // Another payer: asked again. Its 97035 rule is paused, so nothing acts.
    await userEvent.click(within(tester).getByRole('combobox', { name: 'Payer' }))
    await userEvent.click(await screen.findByRole('option', { name: 'UnitedHealthcare' }))
    await waitFor(() =>
      expect(previewMock).toHaveBeenCalledWith(
        { practiceId: 1, insuranceId: 4, procedureCodeId: 35 },
        expect.anything(),
      ),
    )
    await waitFor(() =>
      expect(tester).toHaveTextContent('Claim after the rules97010 · 97014 · 97035No code changed.'),
    )

    await userEvent.click(within(tester).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('says what is needed first when there are no procedure codes', async () => {
    codesMock.mockReturnValue([])
    rules = []
    renderAt()
    expect(await screen.findByText('No coding rules yet', undefined, { timeout: 5000 })).toBeVisible()
    expect(screen.getByText('Rules act on procedure codes, and there are none yet.')).toBeVisible()
    // The one next step, in the empty state itself.
    expect(screen.getByRole('link', { name: 'Add a procedure code' })).toHaveAttribute(
      'href',
      '/setup/procedure-codes',
    )
    await userEvent.click(screen.getByRole('button', { name: 'New rule' }))
    const dialog = screen.getByRole('dialog', { name: 'Cannot add a coding rule yet' })
    expect(within(dialog).getByRole('link', { name: 'Add a procedure code' })).toHaveAttribute(
      'href',
      '/setup/procedure-codes',
    )
  })

  it('says what a rule is when a practice has none, with New rule right there', async () => {
    rules = []
    renderAt()
    expect(
      await screen.findByText('No coding rules for Harborline Physical Therapy', undefined, {
        timeout: 5000,
      }),
    ).toBeVisible()
    expect(
      screen.getByText(
        'Rules are optional. A Replace rule swaps one code for another; a Drop rule removes it.',
      ),
    ).toBeVisible()
    // Nothing to test yet; no stray note under the empty list.
    expect(screen.getByRole('button', { name: 'Test the rules' })).toBeDisabled()
    expect(screen.queryByText(/rules? ·/)).not.toBeInTheDocument()
    const actions = screen.getAllByRole('button', { name: 'New rule' })
    expect(actions).toHaveLength(2)
    await userEvent.click(actions[1] as HTMLElement)
    expect(screen.getByRole('dialog', { name: 'New coding rule' })).toBeInTheDocument()
  })

  it('says when there is no practice yet', async () => {
    practicesMock.mockReset().mockResolvedValue([])
    renderAt()
    expect(await screen.findByText('No practice yet', undefined, { timeout: 5000 })).toBeVisible()
  })
})
