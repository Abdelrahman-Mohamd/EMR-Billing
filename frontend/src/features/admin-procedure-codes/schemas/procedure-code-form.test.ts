import { describe, expect, it } from 'vitest'
import { procedureCodeResponseSchema } from './procedure-code'
import {
  newProcedureCodeValues,
  procedureCodeFormSchema,
  toProcedureCodeFormValues,
  toProcedureCodePayload,
  type ProcedureCodeFormValues,
} from './procedure-code-form'

// The first message of each field, as the form shows it.
const errorsOf = (values: ProcedureCodeFormValues) => {
  const result = procedureCodeFormSchema.safeParse(values)
  return result.success
    ? {}
    : Object.fromEntries(result.error.issues.reverse().map((issue) => [issue.path.join('.'), issue.message]))
}
const filled: ProcedureCodeFormValues = {
  ...newProcedureCodeValues(),
  code: '98110',
  description: 'Therapeutic exercise',
  defaultFee: '25',
  modifierOverride: true,
  modifiers: ['GP', 'KX', '', ''],
}

describe('procedure code form — the server’s checks', () => {
  it('starts as the prototype does: Therapeutic, active, untimed, override off with four empty slots', () => {
    expect(newProcedureCodeValues()).toEqual({
      code: '',
      description: '',
      defaultFee: '',
      procedureType: 'therapeutic',
      isTimed: false,
      isActive: true,
      modifierOverride: false,
      modifiers: ['', '', '', ''],
    })
  })

  it('requires code, description and type — not the fee', () => {
    expect(errorsOf({ ...newProcedureCodeValues(), procedureType: null })).toEqual({
      code: 'Enter the code.',
      description: 'Enter the description.',
      procedureType: 'Select a procedure type.',
    })
    expect(errorsOf({ ...filled, defaultFee: '' })).toEqual({})
  })

  it('takes a five-character code and an amount of at most two decimals', () => {
    expect(errorsOf({ ...filled, code: '9711' })).toEqual({ code: 'Please enter a valid code.' })
    expect(errorsOf({ ...filled, code: 'g0283' })).toEqual({})
    expect(errorsOf({ ...filled, defaultFee: '12.345' })).toEqual({
      defaultFee: 'Please enter a valid amount.',
    })
  })

  it('takes modifiers of two letters or digits, and at least one while the override is on', () => {
    expect(errorsOf({ ...filled, modifiers: ['G', '', '', ''] })).toEqual({
      'modifiers.0': 'Enter two letters or digits.',
    })
    expect(errorsOf({ ...filled, modifiers: ['', '', '', ''] })).toEqual({
      'modifiers.0': 'Add at least one modifier.',
    })
    expect(errorsOf({ ...filled, modifierOverride: false, modifiers: ['', '', '', ''] })).toEqual({})
  })
})

describe('procedure code payload (contract confirmed 2026-10-08)', () => {
  it('sends the confirmed body, Timed and Active added', () => {
    expect(toProcedureCodePayload(filled)).toEqual({
      code: '98110',
      description: 'Therapeutic exercise',
      procedure_type: 'therapeutic',
      is_timed: false,
      modifier_override: true,
      modifiers: ['GP', 'KX'],
      default_fee: 25,
      is_active: true,
    })
  })

  it('sends no modifiers with the override off, and an empty fee as 0', () => {
    expect(
      toProcedureCodePayload({
        ...filled,
        modifierOverride: false,
        modifiers: ['gp', '', '', ''],
        defaultFee: '',
      }),
    ).toMatchObject({ modifier_override: false, modifiers: [], default_fee: 0 })
  })

  it('reads the server’s code — its fee as a string — back into the form', () => {
    const code = procedureCodeResponseSchema.parse({
      id: 1,
      code: '98110',
      description: 'Therapeutic exercise',
      is_timed: false,
      modifier_override: true,
      modifiers: ['GP', 'KX'],
      default_fee: '25.00',
      procedure_type: 'therapeutic',
      procedure_type_label: 'Therapeutic',
      is_active: true,
      created_at: '2026-10-08T15:26:38.000000Z',
      updated_at: '2026-10-08T15:26:38.000000Z',
    })
    expect(code).toMatchObject({ defaultFee: 25, procedureTypeLabel: 'Therapeutic' })
    expect(toProcedureCodeFormValues(code)).toEqual({ ...filled, defaultFee: '25.00' })
  })
})
