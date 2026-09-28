import { ApiError } from '@/lib/api/api-error'
import type { UsersApi } from './users-api'

/**
 * In-memory users for development and demos (ADR 0006). Never part of a
 * production bundle — see `src/lib/api/mock-data.d.ts`.
 *
 * It plays the server: it receives the real payloads and answers in wire
 * format. It **keeps no passwords** — a created user's password is accepted
 * and dropped, so nothing here can ever return one. It enforces no rule:
 * whether an email must be unique is not stated anywhere.
 *
 * Invented data only: the prototype's fictional staff.
 */
interface UserRecord {
  id: number
  name: string
  email: string
  is_active: boolean
}

const LATENCY_MS = 250

let users: UserRecord[] = [
  { id: 1, name: 'Dana Whitfield', email: 'd.whitfield@harborline.example', is_active: true },
  { id: 2, name: 'Marcus Reyes', email: 'm.reyes@harborline.example', is_active: true },
  { id: 3, name: 'Lena Ortiz', email: 'l.ortiz@harborline.example', is_active: true },
  { id: 4, name: 'Owen Park', email: 'o.park@northgate.example', is_active: false },
]
let nextId = 5

const wait = () => new Promise<void>((resolve) => setTimeout(resolve, LATENCY_MS))

export const mockUsersApi: UsersApi = {
  async list() {
    await wait()
    return users.map((user) => ({ ...user }))
  },
  async create({ name, email, is_active }) {
    await wait()
    const created: UserRecord = { id: nextId++, name, email, is_active }
    users = [...users, created]
    return { ...created }
  },
  async update(id, payload) {
    await wait()
    if (!users.some((user) => user.id === id)) {
      throw new ApiError({ kind: 'not_found', message: 'Not found.', status: 404 })
    }
    const updated: UserRecord = { id, name: payload.name, email: payload.email, is_active: payload.is_active }
    users = users.map((user) => (user.id === id ? updated : user))
    return { ...updated }
  },
}
