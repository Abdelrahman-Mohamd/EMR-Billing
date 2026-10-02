import { describe, expect, it } from 'vitest'
import { flagLetters, levelOf, permissionsFrom, withLevel } from './permissions'
import { roleCodeFrom } from './role'

const none = { c: false, r: false, u: false, d: false }

describe('access levels — the prototype’s reading of C R U D', () => {
  it('reads Edit from create or update, View from read only, Hidden from nothing', () => {
    expect(levelOf({ ...none, c: true, r: true })).toBe('edit')
    expect(levelOf({ ...none, u: true })).toBe('edit')
    expect(levelOf({ ...none, r: true })).toBe('view')
    expect(levelOf(none)).toBe('hidden')
  })

  it('sets the flags a level means; Edit keeps the Delete tick, the others clear it', () => {
    expect(withLevel({ ...none, r: true }, 'edit')).toEqual({ c: true, r: true, u: true, d: false })
    expect(withLevel({ c: true, r: true, u: true, d: true }, 'edit').d).toBe(true)
    expect(withLevel({ c: true, r: true, u: true, d: true }, 'view')).toEqual({ ...none, r: true })
    expect(withLevel({ c: true, r: true, u: true, d: true }, 'hidden')).toEqual(none)
  })

  it('shows the flags as letters', () => {
    expect(flagLetters({ c: true, r: true, u: true, d: true })).toBe('C R U D')
    expect(flagLetters({ ...none, r: true })).toBe('R')
    expect(flagLetters(none)).toBe('—')
  })

  it('builds a permission set per module', () => {
    const permissions = permissionsFrom({ BILLING: 'CRU', REPORTS: 'R' })
    expect(permissions.BILLING).toEqual({ c: true, r: true, u: true, d: false })
    expect(permissions.REPORTS).toEqual({ ...none, r: true })
    expect(permissions.ADMIN).toEqual(none)
    expect(Object.values(permissionsFrom('*')).every((flags) => flags.d)).toBe(true)
  })
})

it('names a new role’s code from its name, as the prototype does', () => {
  expect(roleCodeFrom('Payment poster')).toBe('PAYMENT_POSTER')
  expect(roleCodeFrom('  A/R follow-up lead ')).toBe('A_R_FOLLOW_UP_LEAD')
})
