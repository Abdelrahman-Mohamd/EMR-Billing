import { ApiError } from '@/lib/api/api-error'
import type { OrganizationPayload } from '../schemas/organization'
import type { OrganizationsApi } from './organizations-api'

/**
 * In-memory organizations for development and demos (ADR 0006). Never part of
 * a production bundle — see `src/lib/api/mock-data.d.ts`.
 *
 * It plays the server: it takes the real request payload and answers in wire
 * format (snake_case, numeric ids). It behaves like the contract the screen
 * expects and no more: a list, create, update, a short delay so loading states
 * are visible, and the one rule V2 states (a name is unique). The uniqueness
 * comparison here is a stand-in; the server's own rule (case, spacing) is
 * unknown.
 *
 * Invented data only: the prototype's fictional owner group. Its id is the one
 * the practices mock points at.
 */
interface OrganizationRecord extends OrganizationPayload {
  id: number
}

const LATENCY_MS = 250

let organizations: OrganizationRecord[] = [{ id: 1, name: 'Harborline Rehab Group', is_active: true }]
let nextId = 2

const wait = () => new Promise<void>((resolve) => setTimeout(resolve, LATENCY_MS))

function rejectDuplicate(name: string, exceptId?: number): void {
  const taken = organizations.some(
    (organization) =>
      organization.id !== exceptId && organization.name.trim().toLowerCase() === name.trim().toLowerCase(),
  )
  if (taken) {
    throw new ApiError({
      kind: 'validation',
      message: 'Some fields need attention.',
      status: 422,
      fieldErrors: [{ path: 'name', message: 'An organization with this name already exists.' }],
    })
  }
}

export const mockOrganizationsApi: OrganizationsApi = {
  async list() {
    await wait()
    return organizations.map((organization) => ({ ...organization }))
  },
  async create(payload) {
    await wait()
    rejectDuplicate(payload.name)
    const created: OrganizationRecord = {
      id: nextId++,
      name: payload.name.trim(),
      is_active: payload.is_active,
    }
    organizations = [...organizations, created]
    return { ...created }
  },
  async update(id, payload) {
    await wait()
    const existing = organizations.find((organization) => organization.id === id)
    if (!existing) throw new ApiError({ kind: 'not_found', message: 'Not found.', status: 404 })
    rejectDuplicate(payload.name, id)
    const updated: OrganizationRecord = {
      ...existing,
      name: payload.name.trim(),
      is_active: payload.is_active,
    }
    organizations = organizations.map((organization) => (organization.id === id ? updated : organization))
    return { ...updated }
  },
}
