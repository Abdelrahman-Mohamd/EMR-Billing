import { useLocations } from '@/features/admin-practices'
import { useProcedureCodes } from '@/features/admin-procedure-codes'
import { providerName, useProviders } from '@/features/admin-providers'
import { usePatientRecords } from '@/features/patients'
import { formatIsoDate } from '@/lib/utils/dates'
import type { Visit } from '../schemas/visit'

/**
 * Turns a visit's references into what a person reads, where the visit does
 * not carry the name itself: a procedure code's code and description (by its
 * id), a provider, an authorization, the practice a visit's patient belongs
 * to. Never a raw id on screen. Reads the features that own those records
 * (Patients, Practices & locations, Providers, Procedure codes), which also
 * fill the new visit's pickers.
 */
export function useVisitReferences() {
  const records = usePatientRecords()
  // Every location of every practice: the pickers offer the patient's practice's.
  const allLocations = useLocations()
  const providers = useProviders()
  const codes = useProcedureCodes()

  const locations = allLocations.data ?? []

  return {
    /** False until the lists the names come from have arrived. */
    ready: records.ready && !codes.isPending && !allLocations.isPending && !providers.isPending,
    /** The practice of the visit's patient — for the practice filter. */
    practiceOf: (visit: Pick<Visit, 'patientId'>) =>
      records.patients.find((patient) => patient.id === visit.patientId)?.practiceId,
    /** "Okonkwo, Nadia", as the visit names its patient. */
    patientListName: (visit: Pick<Visit, 'patientFirstName' | 'patientLastName'>) =>
      `${visit.patientLastName}, ${visit.patientFirstName}`,
    /** "Nadia Okonkwo". */
    patientFullName: (visit: Pick<Visit, 'patientFirstName' | 'patientLastName'>) =>
      `${visit.patientFirstName} ${visit.patientLastName}`,
    providerName: (id: number) => {
      const provider = providers.data?.find((item) => item.id === id)
      return provider === undefined ? '—' : providerName(provider)
    },
    /** "0VJL671TT · 07/10/2026 – 12/31/2026", by the authorization's id. */
    authorizationLabel: (id: string | null) => {
      if (id === null) return ''
      const auth = records.authorizations.find((item) => item.id === id)
      return auth === undefined
        ? '—'
        : `${auth.number} · ${formatIsoDate(auth.start)} – ${formatIsoDate(auth.end)}`
    },
    /** "98110" and "Therapeutic exercise", by the procedure code's id. */
    procedure: (id: number) => {
      const found = (codes.data ?? []).find((item) => item.id === id)
      return { code: found?.code ?? '—', description: found?.description ?? '' }
    },
    // Pickers for a new visit, or a visit's save.
    records,
    /** A practice's locations, active or not. */
    locationsOf: (practiceId: number | undefined) =>
      locations.filter((location) => location.practiceId === practiceId),
    providers: providers.data ?? [],
    codes: codes.data ?? [],
  }
}

export type VisitReferences = ReturnType<typeof useVisitReferences>
