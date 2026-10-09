import { renameFieldErrors } from '@/lib/api/api-error'
import { request } from '@/lib/api/http-client'
import { serverMessageSchema, type ServerMessage } from '@/lib/api/server-message'
import type { Patient, PatientSummary } from '../model/patient'
import {
  patientDetailResponseSchema,
  patientFormFieldFor,
  patientPageResponseSchema,
  type PatientFieldsPayload,
  type PatientPayload,
  type PatientUpdatePayload,
} from '../schemas/patient'
import { toPatientPayload, toPatientUpdatePayload, type PatientFormValues } from '../schemas/patient-form'

/**
 * Patients' only door to a server. **Live** (contracts confirmed 2026-10-08),
 * carrying the session's token: `GET /patients?page=N`, `GET /patients/{id}`,
 * `POST /patients`, `PUT /patients/{id}` and `DELETE`. Only `page` is sent to
 * the list — a patient's name or any other PHI never goes in a URL. Writes
 * resolve with the server's message, which the screens show. Nothing a patient
 * holds is ever logged. Shapes in schemas/patient.ts.
 */
export interface PatientsApi {
  list: (page: number, signal?: AbortSignal) => Promise<{ patients: PatientSummary[]; pageCount: number }>
  get: (id: string, signal?: AbortSignal) => Promise<Patient>
  create: (payload: PatientPayload) => Promise<ServerMessage>
  update: (
    id: string,
    payload: PatientUpdatePayload | PatientFieldsPayload | { is_active: boolean },
  ) => Promise<ServerMessage>
  remove: (id: string) => Promise<ServerMessage>
}

// The id is the server's, as text; it goes back as it came.
const path = (id: string) => `/patients/${encodeURIComponent(id)}`

const live: PatientsApi = {
  list: (page, signal) =>
    request({
      method: 'GET',
      path: '/patients',
      searchParams: { page },
      schema: patientPageResponseSchema,
      ...(signal ? { signal } : {}),
    }),
  get: (id, signal) =>
    request({
      method: 'GET',
      path: path(id),
      schema: patientDetailResponseSchema,
      ...(signal ? { signal } : {}),
    }),
  create: (payload) =>
    request({ method: 'POST', path: '/patients', body: payload, schema: serverMessageSchema }),
  update: (id, payload) =>
    request({ method: 'PUT', path: path(id), body: payload, schema: serverMessageSchema }),
  remove: (id) => request({ method: 'DELETE', path: path(id), schema: serverMessageSchema }),
}

function backend(): Promise<PatientsApi> {
  return Promise.resolve(live)
}

async function send(call: (api: PatientsApi) => Promise<ServerMessage>): Promise<ServerMessage> {
  try {
    return await call(await backend())
  } catch (error) {
    throw renameFieldErrors(error, patientFormFieldFor)
  }
}

/**
 * Every patient — the roster searches and filters on screen, and visits and
 * Exceptions look patients up by id. The list is paged by the server, so this
 * reads page 1, then the rest at once.
 */
export async function listPatients(signal?: AbortSignal): Promise<PatientSummary[]> {
  const api = await backend()
  const first = await api.list(1, signal)
  const rest = await Promise.all(
    Array.from({ length: first.pageCount - 1 }, (_, index) => api.list(index + 2, signal)),
  )
  return [first, ...rest].flatMap((page) => page.patients)
}

export async function getPatient(id: string, signal?: AbortSignal): Promise<Patient> {
  return (await backend()).get(id, signal)
}

export function createPatient(values: PatientFormValues): Promise<ServerMessage> {
  return send((api) => api.create(toPatientPayload(values)))
}

export function updatePatient(id: string, values: PatientFormValues): Promise<ServerMessage> {
  return send((api) => api.update(id, toPatientUpdatePayload(values)))
}

/** Exceptions' fixes: only the fields the fix changes; the rest of the record stays as it is. */
export function updatePatientFields(id: string, fields: PatientFieldsPayload): Promise<ServerMessage> {
  return send((api) => api.update(id, fields))
}

/** Activates or deactivates a patient: a save carrying `is_active` alone. */
export function setPatientActive(id: string, isActive: boolean): Promise<ServerMessage> {
  return send((api) => api.update(id, { is_active: isActive }))
}

export function deletePatient(id: string): Promise<ServerMessage> {
  return send((api) => api.remove(id))
}
