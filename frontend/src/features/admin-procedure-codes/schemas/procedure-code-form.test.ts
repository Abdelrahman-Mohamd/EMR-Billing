import { describe, expect, it } from 'vitest'
import {
  newProcedureCodeValues,
  procedureCodeFormSchema,
  toProcedureCode,
  toProcedureCodeFormValues,
  type ProcedureCodeFormValues,
} from './procedure-code-form'

const errorsOf = (values: ProcedureCodeFormValues, existing: readonly string[] | null = []) => {
  const result = procedureCodeFormSchema(existing).safeParse(values)
  return result.success
    ? {}
    : Object.fromEntries(result.error.issues.map((issue) => [issue.path.join('.'), issue.message]))
}
const filled: ProcedureCodeFormValues = {
  ...newProcedureCodeValues(),
  code: '97999',
  description: 'Unlisted procedure',
  defaultFee: '25.5',
}

describe('procedure code form — the prototype’s checks', () => {
  it('starts as the prototype does: Therapeutic, active, untimed, override off with four empty slots', () => {
    expect(newProcedureCodeValues()).toEqual({
      code: '',
      description: '',
      defaultFee: '',
      procedureType: 'Therapeutic',
      isTimed: false,
      isActive: true,
      modifierOverride: false,
      modifiers: ['', '', '', ''],
    })
  })

  it('requires code, description, fee and type', () => {
    expect(errorsOf({ ...newProcedureCodeValues(), procedureType: null })).toEqual({
      code: 'Enter the code.',
      description: 'Enter the description.',
      defaultFee: 'Enter the default fee.',
      procedureType: 'Select a procedure type.',
    })
  })

  it('takes a five-character code not already in the list, and an amount', () => {
    expect(errorsOf({ ...filled, code: '9711' })).toEqual({ code: 'Please enter a valid code.' })
    expect(errorsOf({ ...filled, code: '97110' }, ['97110'])).toEqual({ code: 'This code exists.' })
    expect(errorsOf({ ...filled, code: 'g0283' })).toEqual({})
    expect(errorsOf({ ...filled, defaultFee: '12.345' })).toEqual({
      defaultFee: 'Please enter a valid amount.',
    })
  })

  it('does not check a code against the list when editing it', () => {
    expect(errorsOf({ ...filled, code: '97110' }, null)).toEqual({})
  })

  it('accepts any modifiers — the client asked for no new validation', () => {
    expect(errorsOf({ ...filled, modifierOverride: true, modifiers: ['zz', '', '9', ''] })).toEqual({})
  })
})

describe('saving a procedure code', () => {
  it('keeps up to four modifiers, in capitals, only while the override is on', () => {
    const on = toProcedureCode({ ...filled, modifierOverride: true, modifiers: ['gp', '', 'kx', '59'] })
    expect(on.modifiers).toEqual(['GP', 'KX', '59'])
    expect(
      toProcedureCode({ ...filled, modifierOverride: false, modifiers: ['GP', '', '', ''] }).modifiers,
    ).toEqual([])
  })

  it('reads a saved code back into the same form, and clears “New from EMR” on save', () => {
    const saved = { ...toProcedureCode(filled), isNewFromEmr: true }
    expect(toProcedureCodeFormValues(saved)).toEqual({ ...filled, defaultFee: '25.50' })
    expect(toProcedureCode(toProcedureCodeFormValues(saved)).isNewFromEmr).toBe(false)
  })
})
