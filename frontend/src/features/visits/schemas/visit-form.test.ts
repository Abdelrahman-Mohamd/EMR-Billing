import { describe, expect, it } from 'vitest'
import {
  editVisitFormSchema,
  newChargeLineValues,
  splitModifiers,
  toCreateVisitPayload,
  toUpdateVisitPayload,
  visitFormSchema,
  type VisitFormValues,
} from './visit-form'
import { visitFormFieldFor } from './visit'

const messages = (result: {
  success: boolean
  error?: { issues: Array<{ path: PropertyKey[]; message: string }> }
}) =>
  result.success
    ? []
    : (result.error?.issues ?? []).map((issue) => `${issue.path.join('.')}: ${issue.message}`)

const filled: VisitFormValues = {
  caseId: '1',
  dateOfService: '2026-07-15',
  locationId: '3',
  billingProviderId: '3',
  treatingProviderId: '3',
  authorizationId: null,
  diagnosisCodes: ['M75.101', 'M25.511'],
  lines: [
    { procedureCode: '3', units: '2', modifiers: '', diagnosisPointers: [], placeOfService: '', notes: '' },
    {
      procedureCode: '3',
      units: '1',
      modifiers: 'gp, 59',
      diagnosisPointers: ['2', '1'],
      placeOfService: '22',
      notes: 'Left shoulder too',
    },
  ],
}

describe('the visit payload', () => {
  it('is the contract’s example, field for field — a line leaves out what it has none of', () => {
    expect(toCreateVisitPayload(filled)).toEqual({
      case_id: 1,
      date_of_service: '2026-07-15',
      location_id: 3,
      billing_provider_id: 3,
      treating_provider_id: 3,
      authorization_id: null,
      // Its own diagnoses, in pointer order (2026-10-20).
      diagnosis_codes: ['M75.101', 'M25.511'],
      charge_lines: [
        { procedure_code_id: 3, units: 2 },
        // Its own place of service and a note: the server takes both (user, 2026-10-09).
        {
          procedure_code_id: 3,
          units: 1,
          modifiers: ['GP', '59'],
          diagnosis_pointers: [2, 1],
          place_of_service: '22',
          notes: 'Left shoulder too',
        },
      ],
    })
  })

  it('a save carries the visit’s own fields — not its case, not its lines', () => {
    expect(toUpdateVisitPayload({ ...filled, authorizationId: '16' })).toEqual({
      date_of_service: '2026-07-15',
      location_id: 3,
      billing_provider_id: 3,
      treating_provider_id: 3,
      authorization_id: 16,
      diagnosis_codes: ['M75.101', 'M25.511'],
    })
  })

  it('reads modifiers separated by commas or spaces, in capitals', () => {
    expect(splitModifiers(' gp,59  kx ')).toEqual(['GP', '59', 'KX'])
    expect(splitModifiers('')).toEqual([])
  })

  it('puts the server’s line errors on the line’s field', () => {
    expect(visitFormFieldFor('charge_lines.1.units')).toBe('lines.1.units')
    expect(visitFormFieldFor('charge_lines.0.modifiers.0')).toBe('lines.0.modifiers')
    expect(visitFormFieldFor('charge_lines.0.diagnosis_pointers.1')).toBe('lines.0.diagnosisPointers')
    expect(visitFormFieldFor('charge_lines.0.procedure_code_id')).toBe('lines.0.procedureCode')
    expect(visitFormFieldFor('charge_lines.1.place_of_service')).toBe('lines.1.placeOfService')
    expect(visitFormFieldFor('charge_lines.0.notes')).toBe('lines.0.notes')
    expect(visitFormFieldFor('date_of_service')).toBe('dateOfService')
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
          lines: [newChargeLineValues(), { ...newChargeLineValues(), procedureCode: '3', units: '' }],
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

  it('holds the server’s limits: date, units, modifiers and pointers', () => {
    expect(
      messages(
        schema.safeParse({
          ...filled,
          dateOfService: '2026-10-03',
          lines: [
            {
              procedureCode: '3',
              units: '100',
              modifiers: 'GP 59 KX XU 76',
              diagnosisPointers: [],
              placeOfService: '2',
              notes: 'n'.repeat(1001),
            },
            {
              procedureCode: '3',
              units: '1.5',
              modifiers: 'G',
              diagnosisPointers: ['1', '2', '3', '4', '5'],
              placeOfService: '',
              notes: '',
            },
          ],
        }),
      ),
    ).toEqual([
      'lines.0.units: Enter a whole number from 1 to 99.',
      'lines.0.modifiers: Enter up to four modifiers.',
      'lines.0.placeOfService: Enter two digits, e.g. 11.',
      'lines.0.notes: Use at most 1000 characters.',
      'lines.1.units: Enter a whole number from 1 to 99.',
      'lines.1.modifiers: Each modifier is two letters or digits, e.g. GP or 59.',
      'lines.1.diagnosisPointers: Choose up to four diagnoses.',
      'dateOfService: Enter a date of service on or before today.',
    ])
  })

  it('a save asks for the visit’s own fields', () => {
    expect(
      messages(
        editVisitFormSchema('2026-10-02').safeParse({
          dateOfService: '',
          locationId: null,
          billingProviderId: '3',
          treatingProviderId: null,
          authorizationId: null,
          diagnosisCodes: Array.from({ length: 13 }, (_, index) => `M54.${index}`),
        }),
      ),
    ).toEqual([
      'diagnosisCodes: Choose up to 12 diagnoses.',
      'dateOfService: Enter the date of service.',
      'locationId: Select a location.',
      'treatingProviderId: Select the treating provider.',
    ])
  })
})
