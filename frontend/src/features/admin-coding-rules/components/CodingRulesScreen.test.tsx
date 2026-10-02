import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
import { useToastStore } from '@/stores/toast-store'
import { createTestQueryClient, renderWithProviders } from '@/test/render'
import type { Insurance, InsuranceClass } from '@/features/admin-insurances'
import type { Practice } from '@/features/admin-practices'
import type { ProcedureCode } from '@/features/admin-procedure-codes'
import { resetCodingRules } from '../data/coding-rule-store'
import type { CodingRule } from '../model/coding-rule'

// Coding rules are frontend only: their in-tab store starts from a known list.
// The practices, insurances, classes and procedure codes are other features'
// integration points: faked by path, never imported (lint forbids it).
const practicesMock = vi.hoisted(() => vi.fn<() => Promise<Practice[]>>())
const insurancesMock = vi.hoisted(() => vi.fn<() => Promise<Insurance[]>>())
const classesMock = vi.hoisted(() => vi.fn<() => Promise<InsuranceClass[]>>())
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
vi.mock('@/features/admin-insurances/api/insurance-classes-api', () => ({
  listInsuranceClasses: classesMock,
  createInsuranceClass: vi.fn(),
  updateInsuranceClass: vi.fn(),
}))
vi.mock('@/features/admin-procedure-codes/data/procedure-code-store', () => ({
  useProcedureCodes: () => ({ ready: true, codes: codesMock(), save: vi.fn() }),
  resetProcedureCodes: vi.fn(),
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
const insurance = (id: number, practiceId: number, insuranceClassId: number, name: string) =>
  ({ id, practiceId, insuranceClassId, code: id, name, isActive: true }) as Insurance
const insuranceClass = (id: number, practiceId: number, name: string, isActive = true) =>
  ({ id, practiceId, code: `C${id}`, name, isActive }) as InsuranceClass
const code = (value: string, description: string) => ({ code: value, description }) as ProcedureCode

const rule = (overrides: Partial<CodingRule> & Pick<CodingRule, 'id'>): CodingRule => ({
  type: 'Drop',
  fromCode: '97010',
  toCode: '',
  scope: { kind: 'default' },
  note: '',
  isActive: true,
  ...overrides,
})

beforeEach(() => {
  practicesMock
    .mockReset()
    .mockResolvedValue([practice(1, 'Harborline Physical Therapy'), practice(2, 'Northgate')])
  insurancesMock
    .mockReset()
    .mockResolvedValue([
      insurance(1, 1, 1, 'Medicare Part B'),
      insurance(4, 1, 3, 'UnitedHealthcare'),
      insurance(9, 2, 7, 'Northgate Medicare'),
    ])
  classesMock
    .mockReset()
    .mockResolvedValue([
      insuranceClass(1, 1, 'Medicare'),
      insuranceClass(3, 1, 'Commercial'),
      insuranceClass(5, 1, 'Retired class', false),
      insuranceClass(7, 2, 'Northgate Medicare'),
    ])
  codesMock
    .mockReset()
    .mockReturnValue([
      code('97010', 'Hot or cold packs'),
      code('97014', 'Electrical stimulation, unattended'),
      code('97035', 'Ultrasound therapy'),
      code('G0283', 'Electrical stimulation, unattended (Medicare)'),
    ])
  resetCodingRules([
    rule({
      id: 'r1',
      type: 'Replace',
      fromCode: '97014',
      toCode: 'G0283',
      scope: { kind: 'insurance', insuranceId: 1 },
      note: 'Medicare requires G0283 for unattended e-stim.',
    }),
    rule({ id: 'r2', note: 'Hot/cold packs are bundled for most payers.' }),
    rule({
      id: 'r3',
      type: 'Replace',
      fromCode: '97014',
      toCode: 'G0283',
      scope: { kind: 'insurance', insuranceId: 9 },
    }),
    rule({ id: 'r4', fromCode: '97035', scope: { kind: 'insurance', insuranceId: 4 }, isActive: false }),
  ])
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
        'Replace and Drop rules run during scrubbing; payer-specific rules override default rules.',
      ),
    ).toBeVisible()
    const rules = await table()
    // Northgate's rule belongs to another practice.
    expect(dataRows(rules)).toHaveLength(3)
    const medicare = rowOf(rules, 'Medicare requires')
    expect(medicare).toHaveTextContent('97014 → G0283')
    expect(medicare).toHaveTextContent('Medicare Part B only')
    const bundled = rowOf(rules, 'Hot/cold')
    expect(bundled).toHaveTextContent('97010 → dropped')
    expect(bundled).toHaveTextContent('Default (all payers)')
    expect(within(rowOf(rules, '97035')).getByRole('switch')).toHaveAttribute('aria-checked', 'false')
    expect(
      screen.getByText(
        'Rules run on fresh submissions, resubmissions and corrected claims, and change the billing record itself.',
      ),
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
    expect(dataRows(rules)).toHaveLength(2)
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
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-checked', 'true')
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
    // Which rule wins is explained behind the field's info icon, not under it.
    expect(within(dialog).getByRole('button', { name: 'About Applies to' })).toHaveAccessibleDescription(
      'A payer rule wins over its class rule, and a class rule wins over the default.',
    )

    await userEvent.click(within(dialog).getByRole('button', { name: 'Save rule' }))
    expect(await within(dialog).findByText('Select a code.')).toBeVisible()
    expect(within(dialog).getByText('Select the code to replace it with.')).toBeVisible()

    await pick(dialog, /^code/i, /^97014/)
    await pick(dialog, /replace with/i, /^97014/)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save rule' }))
    expect(await within(dialog).findByText('Please choose a different code.')).toBeVisible()

    await pick(dialog, /replace with/i, /^G0283/)
    // Applies to: the default, the practice's active classes, then its insurances.
    await userEvent.click(within(dialog).getByRole('combobox', { name: /applies to/i }))
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Default — all payers',
      'Class — Medicare',
      'Class — Commercial',
      'Medicare Part B only (overrides default)',
      'UnitedHealthcare only (overrides default)',
    ])
    await userEvent.click(screen.getByRole('option', { name: 'UnitedHealthcare only (overrides default)' }))
    await userEvent.type(within(dialog).getByRole('textbox', { name: /why/i }), 'UHC contract')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save rule' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const added = rowOf(await table(), 'UHC contract')
    expect(added).toHaveTextContent('97014 → G0283')
    expect(added).toHaveTextContent('UnitedHealthcare only')
    expect(within(added).getByRole('switch')).toHaveAttribute('aria-checked', 'true')
    expect(useToastStore.getState().toasts).toEqual([
      expect.objectContaining({
        tone: 'success',
        title: 'Rule saved',
        description: 'It runs on the next scrub.',
      }),
    ])
  })

  it('creates a Drop rule for a class: no replacement needed', async () => {
    renderAt()
    const dialog = await openNew()
    await pick(dialog, /rule type/i, /^Drop/)
    expect(within(dialog).getByRole('combobox', { name: /replace with/i })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    await pick(dialog, /^code/i, /^97035/)
    await pick(dialog, /applies to/i, 'Class — Commercial')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save rule' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const rules = await table()
    const added = dataRows(rules).at(-1) as HTMLElement
    expect(added).toHaveTextContent('97035 → dropped')
    expect(added).toHaveTextContent('Commercial class')
  })

  it('edits a rule', async () => {
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
    await pick(dialog, /applies to/i, 'Class — Medicare')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save rule' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(rowOf(rules, 'Hot/cold')).toHaveTextContent('Medicare class')
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
  })

  it('tests the rules: codes picked from the list, what each becomes and why, and the claim after', async () => {
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
    expect(items()).toHaveLength(3)
    // In the list's order, as the chips show them. The UnitedHealthcare rule for
    // 97035 is paused, and does not apply to Medicare anyway.
    expect(items()[0]).toHaveTextContent('97010 → becomes droppedDropped · Default (all payers)')
    expect(items()[1]).toHaveTextContent(
      '97014 → becomes G0283Replaced · Medicare Part B onlyMedicare requires G0283 for unattended e-stim.',
    )
    expect(items()[2]).toHaveTextContent('97035No rule applies')
    expect(tester).toHaveTextContent('Claim after the rulesG0283 · 970352 of 3 codes changed.')

    await userEvent.click(within(tester).getByRole('combobox', { name: 'Payer' }))
    await userEvent.click(await screen.findByRole('option', { name: 'UnitedHealthcare' }))
    expect(items()[0]).toHaveTextContent('97010 → becomes droppedDropped · Default (all payers)')
    expect(items()[1]).toHaveTextContent('97014No rule applies')
    expect(items()[2]).toHaveTextContent('97035No rule applies')
    expect(tester).toHaveTextContent('Claim after the rules97014 · 970351 of 3 codes changed.')

    await userEvent.click(within(tester).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('says when a payer rule wins over the default rule for the same code', async () => {
    resetCodingRules([
      rule({ id: 'd', fromCode: '97014' }),
      rule({
        id: 'p',
        type: 'Replace',
        fromCode: '97014',
        toCode: 'G0283',
        scope: { kind: 'insurance', insuranceId: 1 },
      }),
    ])
    renderAt()
    await table()
    const tester = await openTester()
    await userEvent.click(within(tester).getByRole('combobox', { name: 'Codes on the claim' }))
    await userEvent.click(await screen.findByRole('option', { name: /^97014/ }))
    await userEvent.keyboard('{Escape}')
    expect(within(tester).getByRole('listitem')).toHaveTextContent(
      'Replaced · Medicare Part B only · overrides the default rule',
    )
  })

  it('says what is needed first when there are no procedure codes', async () => {
    codesMock.mockReturnValue([])
    resetCodingRules([])
    renderAt()
    expect(await screen.findByText('No coding rules yet', undefined, { timeout: 5000 })).toBeVisible()
    expect(screen.getByText(/Rules act on procedure codes, so add those first\./)).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'New rule' }))
    const dialog = screen.getByRole('dialog', { name: 'Cannot add a coding rule yet' })
    expect(within(dialog).getByRole('link', { name: 'Add a procedure code' })).toHaveAttribute(
      'href',
      '/setup/procedure-codes',
    )
  })

  it('says when there is no practice yet', async () => {
    practicesMock.mockReset().mockResolvedValue([])
    renderAt()
    expect(await screen.findByText('No practice yet', undefined, { timeout: 5000 })).toBeVisible()
  })
})
