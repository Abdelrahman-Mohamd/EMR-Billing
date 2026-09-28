import { z } from 'zod'

/**
 * An organization, as the frontend knows it today.
 *
 * PRD V2 §10.2 defines the `company` table as `name` (unique) and `is_active`,
 * and nothing else; the meeting of 2026-09-23 confirmed that a System Admin
 * creates organizations. The current backend payload agrees:
 * `{ "name": "PTc Health Group", "is_active": true }`. That is the whole model
 * here. What an organization *changes* — for access, for reports, for the
 * practices in it — is still open (Q-032), so nothing depends on it.
 *
 * A practice points at its organization through `organization_id`, a number in
 * the practice payload, so organization ids are numbers.
 *
 * Wire format (snake_case) is parsed and mapped to this camelCase shape in one
 * place, the schema below; screens never see the wire shape.
 */
export const organizationResponseSchema = z
  .object({
    // Assumption: a saved organization comes back as its payload plus its id.
    id: z.number().int(),
    name: z.string(),
    is_active: z.boolean(),
  })
  .transform((wire) => ({ id: wire.id, name: wire.name, isActive: wire.is_active }))

export type Organization = z.output<typeof organizationResponseSchema>

/** The request body for create and update — the known payload, exactly. */
export interface OrganizationPayload {
  name: string
  is_active: boolean
}

/**
 * What the create/edit form accepts. Only the rules that are known:
 * a name is required. Uniqueness (V2: `name` UQ) is the server's to enforce —
 * the browser cannot check it against records it has not loaded, and does not
 * know whether "Harborline" and "harborline " count as the same name. A
 * rejection comes back as a field error on `name`.
 */
export const organizationFormSchema = z.object({
  name: z.string().trim().min(1, 'Enter the organization name.'),
  isActive: z.boolean(),
})

export type OrganizationFormValues = z.infer<typeof organizationFormSchema>

export function toOrganizationPayload(values: OrganizationFormValues): OrganizationPayload {
  return { name: values.name, is_active: values.isActive }
}
