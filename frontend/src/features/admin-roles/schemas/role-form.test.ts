import { describe, expect, it } from 'vitest'
import { roleFormSchema } from './role-form'

const schema = roleFormSchema(['Practice Admin', 'Billing Viewer'])
const messages = (values: unknown) => {
  const result = schema.safeParse(values)
  return result.success ? [] : result.error.issues.map((issue) => issue.message)
}

describe('the New role form', () => {
  it('asks for a name and a role to start from', () => {
    expect(messages({ name: '  ', from: null })).toEqual([
      'Enter the role name.',
      'Select a role to start from.',
    ])
  })

  it('refuses a name another role has, ignoring case and spaces', () => {
    expect(messages({ name: ' billing viewer ', from: 'PRACTICE_ADMIN' })).toEqual([
      'A role with this name exists.',
    ])
  })

  it('accepts a new name', () => {
    expect(schema.parse({ name: ' Payment poster ', from: 'PRACTICE_ADMIN' })).toEqual({
      name: 'Payment poster',
      from: 'PRACTICE_ADMIN',
    })
  })
})
