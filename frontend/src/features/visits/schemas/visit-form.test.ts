import { describe, expect, it } from 'vitest'
import {
  newChargeLineValues,
  splitModifiers,
  toCreateChargeLinePayload,
  toCreateVisitPayload,
  visitFormSchema,
  type VisitFormValues,
} from './visit-form'

const messages = (result: {
  success: boolean
  error?: { issues: Array<{ path: PropertyKey[]; message: string }> }
}) =>
  result.success
    ? []
    : (result.error?.issues ?? []).map((issue) => `${issue.path.join('.')}: ${issue.message}`)

const filled: VisitFormValues = {
  caseId: 'p1-case',
  dateOfService: '2026-07-15',
  locationId: '3',
  billingProviderId: '3',
  treatingProviderId: '3',
  authorizationId: null,
  lines: [
    { procedureCode: '97110', units: '2', modifiers: '', diagnosisPointers: [] },
    { procedureCode: '97110', units: '1', modifiers: 'gp, 59', diagnosisPointers: ['2', '1'] },
  ],
}

describe('the visit payload', () => {
  it('is the backend’s example, field for field — a line without modifiers or pointers leaves them out', () => {
    expect(toCreateVisitPayload(filled)).toEqual({
      case_id: 'p1-case',
      date_of_service: '2026-07-15',
      location_id: 3,
      billing_provider_id: 3,
      treating_provider_id: 3,
      authorization_id: null,
      charge_lines: [
        { procedure_code_id: '97110', units: 2 },
        { procedure_code_id: '97110', units: 1, modifiers: ['GP', '59'], diagnosis_pointers: [2, 1] },
      ],
    })
  })

  it('a charge line on its own carries its visit', () => {
    expect(
      toCreateChargeLinePayload(2, {
        procedureCode: '97110',
        units: '3',
        modifiers: 'GP',
        diagnosisPointers: ['1'],
      }),
    ).toEqual({
      visit_id: 2,
      procedure_code_id: '97110',
      units: 3,
      modifiers: ['GP'],
      diagnosis_pointers: [1],
    })
  })

  it('reads modifiers separated by commas or spaces, in capitals', () => {
    expect(splitModifiers(' gp,59  kx ')).toEqual(['GP', '59', 'KX'])
    expect(splitModifiers('')).toEqual([])
  })
})

describe('the visit form', () => {
  const schema = visitFormSchema('2026-10-02')

  it('asks for what the payload always carries', () => {
    expect(
      messages(
        schema.safeParse({
          ...filled,
          caseId: null,
          dateOfService: '',
          locationId: null,
          billingProviderId: null,
          treatingProviderId: null,
          lines: [newChargeLineValues(), { ...newChargeLineValues(), procedureCode: '97110', units: '' }],
        }),
      ),
    ).toEqual([
      'lines.0.procedureCode: Select a procedure code.',
      'lines.1.units: Enter the units.',
      'caseId: Select a case.',
      'dateOfService: Enter the date of service.',
      'locationId: Select a location.',
      'billingProviderId: Select the billing provider.',
      'treatingProviderId: Select the treating provider.',
    ])
  })

  it('refuses a date of service in the future, units that are not a whole number, and more than four modifiers', () => {
    expect(
      messages(
        schema.safeParse({
          ...filled,
          dateOfService: '2026-10-03',
          lines: [
            { procedureCode: '97110', units: '1.5', modifiers: 'GP 59 KX XU 76', diagnosisPointers: [] },
          ],
        }),
      ),
    ).toEqual([
      'lines.0.units: Please enter a valid number of units.',
      'lines.0.modifiers: Enter up to four modifiers.',
      'dateOfService: Please enter a valid date.',
    ])
  })
})
