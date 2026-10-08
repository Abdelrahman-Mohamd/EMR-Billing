import { z } from 'zod'

/**
 * An organization, as the backend sends it (contracts confirmed 2026-10-07):
 *
 * - `GET /organizations?page=N` → `{ data: { data: [{ id, name, is_active,
 *   practices_count, created_at }], links, meta: { current_page, last_page,
 *   per_page: 15, from, to, total } } }`;
 * - `GET /organizations/{id}` → `{ data: { id, name, is_active, practices: [],
 *   created_at } }` (an unknown id: `404`);
 * - `POST /organizations` and `PUT /organizations/{id}` take `{ name,
 *   is_active }` and answer `{ success, message, data: null }` — nothing to
 *   read back; `DELETE /organizations/{id}` removes one.
 *
 * PRD V2 §10.2 defines the `company` table as `name` (unique) and `is_active`;
 * the meeting of 2026-09-23 confirmed that a System Admin creates
 * organizations. What an organization *changes* — for access, for reports —
 * is still open (Q-032), so nothing depends on it.
 *
 * A practice points at its organization through `organization_id`, a number,
 * so organization ids are numbers. The detail's `practices` are not read: no
 * practice has been seen in one, so their shape is not known.
 *
 * Wire format (snake_case) is parsed and mapped to camelCase here, in one
 * place; screens never see the wire shape.
 */
export const organizationResponseSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    is_active: z.boolean(),
    practices_count: z.number().int().nonnegative(),
    created_at: z.string(),
  })
  .transform((wire) => ({
    id: wire.id,
    name: wire.name,
    isActive: wire.is_active,
    practicesCount: wire.practices_count,
    createdAt: wire.created_at,
  }))

export type Organization = z.output<typeof organizationResponseSchema>

export const organizationPageResponseSchema = z
  .object({
    data: z.object({
      data: z.array(organizationResponseSchema),
      meta: z.object({
        current_page: z.number().int().positive(),
        last_page: z.number().int().positive(),
        from: z.number().int().nullable().optional(),
        to: z.number().int().nullable().optional(),
        total: z.number().int().nonnegative(),
      }),
    }),
  })
  .transform(({ data }) => ({
    organizations: data.data,
    page: data.meta.current_page,
    pageCount: data.meta.last_page,
    total: data.meta.total,
    from: data.meta.from ?? 0,
    to: data.meta.to ?? 0,
  }))

export type OrganizationPage = z.output<typeof organizationPageResponseSchema>

/** One organization as the edit form needs it: what it can change. */
export const organizationDetailResponseSchema = z
  .object({
    data: z.object({
      id: z.number().int(),
      name: z.string(),
      is_active: z.boolean(),
    }),
  })
  .transform(({ data }) => ({ id: data.id, name: data.name, isActive: data.is_active }))

export type OrganizationDetail = z.output<typeof organizationDetailResponseSchema>

/** The request body for create and update — the confirmed payload, exactly. */
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
