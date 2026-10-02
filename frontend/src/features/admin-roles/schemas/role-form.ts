import { z } from 'zod'

/**
 * What the New role form accepts — the prototype's checks, and only those:
 * - **Role name:** required; no other role may have it, ignoring case
 *   ("A role with this name exists.").
 * - **Start from:** required; the role whose permissions the new one copies.
 *
 * `existingNames` is every role's name.
 */
export function roleFormSchema(existingNames: readonly string[]) {
  const taken = new Set(existingNames.map((name) => name.trim().toLowerCase()))
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, 'Enter the role name.')
      .refine((value) => value === '' || !taken.has(value.toLowerCase()), 'A role with this name exists.'),
    from: z
      .string()
      .nullable()
      .refine((value): boolean => value !== null, 'Select a role to start from.'),
  })
}

export type RoleFormValues = z.infer<ReturnType<typeof roleFormSchema>>
