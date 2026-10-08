import type { SelectOption } from '@/components/ui/Select'

/**
 * The choices the prototype's provider form offers — no others.
 */

/**
 * Provider type: the server's values, `rendering` and `billing` (client,
 * 2026-09-30). What each means is the client's own wording; what the backend
 * does with it is the backend's — the frontend only records and shows the
 * choice. A value outside these two, if the server ever sends one, is shown as
 * it is and kept when the provider is saved.
 */
export const PROVIDER_TYPES = [
  { value: 'rendering', label: 'Rendering', meaning: 'Claims put on hold' },
  { value: 'billing', label: 'Billing', meaning: 'Eligible for submission' },
] as const

export function providerTypeMeaning(value: string): string | undefined {
  return PROVIDER_TYPES.find((type) => type.value === value)?.meaning
}

export function providerTypeOptions(current: string | null): readonly SelectOption[] {
  const options: SelectOption[] = PROVIDER_TYPES.map((type) => ({
    value: type.value,
    label: type.label,
    description: type.meaning,
  }))
  return current === null || options.some((option) => option.value === current)
    ? options
    : [...options, { value: current, label: current }]
}

/** The specialties the prototype offers, written as it writes them. */
export const SPECIALTIES = [
  'PHYSICAL THERAPIST',
  'OCCUPATIONAL THERAPIST',
  'SPEECH-LANGUAGE PATHOLOGIST',
] as const

/** The prototype's specialties, plus a saved one it does not list (the server takes any). */
export function specialtyOptions(current: string | null): readonly SelectOption[] {
  const options: SelectOption[] = SPECIALTIES.map((specialty) => ({ value: specialty, label: specialty }))
  return current === null || options.some((option) => option.value === current)
    ? options
    : [...options, { value: current, label: current }]
}

/** How the prototype names a provider: first and last name, then the credential. */
export function providerName(provider: { firstName: string; lastName: string; credential: string }): string {
  const name = `${provider.firstName} ${provider.lastName}`.trim()
  return provider.credential === '' ? name : `${name}, ${provider.credential}`
}
