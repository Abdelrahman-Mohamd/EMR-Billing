import { z } from 'zod'

/**
 * What the Request integration form accepts — the prototype's checks, and only
 * those:
 * - **Unique Location ID:** required; no other location may hold it ("This ID
 *   is already linked to another location."). No format check: the prototype
 *   has none.
 * - **Note for the approver:** optional.
 *
 * `isTaken` says whether another location already holds an id.
 */
export function requestFormSchema(isTaken: (uniqueLocationId: string) => boolean) {
  return z.object({
    uniqueLocationId: z
      .string()
      .trim()
      .min(1, 'Enter the Unique Location ID.')
      .refine((value) => value === '' || !isTaken(value), 'This ID is already linked to another location.'),
    note: z.string().trim(),
  })
}

export type RequestFormValues = z.infer<ReturnType<typeof requestFormSchema>>
