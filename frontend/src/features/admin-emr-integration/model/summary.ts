import type { LocationIntegration } from './integration'

export interface IntegrationSummary {
  locations: number
  linked: number
  /** Requested, waiting for an approver. */
  awaiting: number
  integrated: number
}

/** How far a practice's locations are along the request → link → elect path. */
export function summarize(integrations: readonly LocationIntegration[]): IntegrationSummary {
  return {
    locations: integrations.length,
    linked: integrations.filter((item) => item.link === 'Linked').length,
    awaiting: integrations.filter((item) => item.link === 'Requested').length,
    integrated: integrations.filter((item) => item.link === 'Linked' && item.election === 'Integrated')
      .length,
  }
}

export const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`
