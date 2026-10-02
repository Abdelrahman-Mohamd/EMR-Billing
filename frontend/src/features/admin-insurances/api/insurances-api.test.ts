import { afterEach, describe, expect, it, vi } from 'vitest'
import { isApiError } from '@/lib/api/api-error'
import { NEW_INSURANCE_CLASS_VALUES } from '../schemas/insurance-class'
import { NEW_INSURANCE_VALUES } from '../schemas/insurance'
import { createInsuranceClass, listInsuranceClasses, updateInsuranceClass } from './insurance-classes-api'
import { createInsurance, listInsurances, updateInsurance } from './insurances-api'

const insurance = {
  ...NEW_INSURANCE_VALUES,
  practiceId: '1',
  code: '1070',
  name: 'Oscar Health',
  insuranceClassId: '3',
  insuranceType: 'Commercial',
  payerId: 'OSCAR',
  portalUrl: 'https://portal.example-payer.com',
  auditRequired: true,
}
const insuranceClass = { ...NEW_INSURANCE_CLASS_VALUES, practiceId: '1', code: 'HMO', name: 'HMO plans' }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('insurance APIs without a backend', () => {
  it('answer every call as unavailable instead of inventing an endpoint', async () => {
    vi.stubGlobal('__MOCK_DATA__', false)
    for (const call of [
      () => listInsurances(),
      () => createInsurance(insurance),
      () => updateInsurance(1, insurance),
      () => listInsuranceClasses(),
      () => createInsuranceClass(insuranceClass),
      () => updateInsuranceClass(1, insuranceClass),
    ]) {
      const error: unknown = await call().catch((caught: unknown) => caught)
      expect(isApiError(error) && error.kind).toBe('unavailable')
    }
  })
})

describe('insurance APIs against the development mock', () => {
  it('create an insurance and read it back in the screen’s shape', async () => {
    const created = await createInsurance(insurance)
    expect(created).toMatchObject({
      practiceId: 1,
      code: 1070,
      insuranceClassId: 3,
      auditRequired: true,
      portalUrl: 'https://portal.example-payer.com',
      rules: { authorizationRequired: null, icdVersion: null },
    })
    expect((await listInsurances()).some((record) => record.id === created.id)).toBe(true)
  })

  it('put a duplicate code (unique per practice, V2) back on the form’s field', async () => {
    const error: unknown = await createInsurance({ ...insurance, code: '1001' }).catch(
      (caught: unknown) => caught,
    )
    expect(isApiError(error) && error.fieldErrors.map((fieldError) => fieldError.path)).toEqual(['code'])
    const classError: unknown = await createInsuranceClass({ ...insuranceClass, code: 'MED' }).catch(
      (caught: unknown) => caught,
    )
    expect(isApiError(classError) && classError.fieldErrors.map((fieldError) => fieldError.path)).toEqual([
      'code',
    ])
  })
})
