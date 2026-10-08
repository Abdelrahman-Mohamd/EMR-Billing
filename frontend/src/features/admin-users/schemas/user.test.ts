import { describe, expect, it } from 'vitest'
import { toCreateUserPayload, toUpdateUserPayload, userResponseSchema } from './user'

describe('user payloads', () => {
  it('creates with exactly { name, email, password, is_active }', () => {
    expect(
      toCreateUserPayload({ name: 'Ada Lin', email: 'ada@example.test', password: 'pw-1', isActive: false }),
    ).toStrictEqual({ name: 'Ada Lin', email: 'ada@example.test', password: 'pw-1', is_active: false })
  })

  it('saves without a password when none was typed, so the current one stays', () => {
    const payload = toUpdateUserPayload({
      name: 'Ada Lin',
      email: 'ada@example.test',
      password: '',
      isActive: true,
    })
    expect(payload).toStrictEqual({ name: 'Ada Lin', email: 'ada@example.test', is_active: true })
    expect(payload).not.toHaveProperty('password')
  })

  it('saves with a new password when one was typed', () => {
    expect(
      toUpdateUserPayload({ name: 'Ada Lin', email: 'ada@example.test', password: 'pw-2', isActive: true }),
    ).toStrictEqual({ name: 'Ada Lin', email: 'ada@example.test', password: 'pw-2', is_active: true })
  })
})

describe('user response', () => {
  it('drops a password if a server ever sends one back', () => {
    const user = userResponseSchema.parse({
      id: 7,
      name: 'Ada Lin',
      email: 'ada@example.test',
      is_active: true,
      password: 'leaked-secret',
    })
    expect(user).toStrictEqual({ id: 7, name: 'Ada Lin', email: 'ada@example.test', isActive: true })
    expect(JSON.stringify(user)).not.toContain('leaked-secret')
  })
})
