/**
 * The choices the prototype's provider form offers — no others.
 */

/**
 * Provider type (client, 2026-09-30). What each means is the client's own
 * wording; what the backend does with it is the backend's — the frontend only
 * records and shows the choice.
 */
export const PROVIDER_TYPES = [
  { value: 'Rendering', label: 'Rendering', meaning: 'Claims put on hold' },
  { value: 'Billing', label: 'Billing', meaning: 'Eligible for submission' },
] as const

export function providerTypeMeaning(value: string): string | undefined {
  return PROVIDER_TYPES.find((type) => type.value === value)?.meaning
}

/** The specialties the prototype offers, written as it writes them. */
export const SPECIALTIES = [
  'PHYSICAL THERAPIST',
  'OCCUPATIONAL THERAPIST',
  'SPEECH-LANGUAGE PATHOLOGIST',
] as const

/** How the prototype names a provider: first and last name, then the credential. */
export function providerName(provider: { firstName: string; lastName: string; credential: string }): string {
  const name = `${provider.firstName} ${provider.lastName}`.trim()
  return provider.credential === '' ? name : `${name}, ${provider.credential}`
}
