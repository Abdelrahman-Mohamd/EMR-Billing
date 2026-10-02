import type { ReactNode } from 'react'
import {
  FormProvider,
  useController,
  type ControllerRenderProps,
  type FieldPath,
  type FieldValues,
  type SubmitHandler,
  type UseFormReturn,
} from 'react-hook-form'
import { cn } from '@/lib/utils/cn'
import { isApiError } from '@/lib/api/api-error'
import { Field, type FieldProps } from './Field'

/**
 * The presentation half of a form. The schema, the values and what submitting
 * means belong to the feature; this file only renders labels, errors and
 * layout, and connects React Hook Form to `Field`.
 *
 *   const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues })
 *
 *   <Form form={form} onSubmit={save}>
 *     <FormGrid>
 *       <FormField name="memberId" label="Member ID" required span={6}>
 *         {(field) => <Input {...field} />}
 *       </FormField>
 *     </FormGrid>
 *   </Form>
 */
export function Form<TValues extends FieldValues>({
  form,
  onSubmit,
  children,
  className,
  id,
}: {
  form: UseFormReturn<TValues>
  onSubmit: SubmitHandler<TValues>
  children: ReactNode
  className?: string
  /**
   * Lets a submit button outside the form — a dialog's footer — submit it
   * with `<Button type="submit" form={id}>`, so Enter in a field and the
   * footer button do the same thing.
   */
  id?: string
}) {
  return (
    <FormProvider {...form}>
      {/* noValidate: the schema decides what is valid, not the browser's own
          bubbles, which cannot be styled or announced consistently. */}
      <form
        id={id}
        noValidate
        onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}
        className={className}
      >
        {children}
      </form>
    </FormProvider>
  )
}

/**
 * One field: label, description, validation message and the control, wired to
 * the form state. The control is a render prop so any of the primitives —
 * Input, Select, SearchSelect, DateInput — can sit inside without this file
 * knowing about them.
 */
export function FormField<TValues extends FieldValues, TName extends FieldPath<TValues>>({
  name,
  label,
  description,
  info,
  required,
  span,
  disabled,
  asFieldset,
  children,
}: {
  name: TName
  children: (field: ControllerRenderProps<TValues, TName>) => ReactNode
} & Omit<FieldProps, 'children' | 'error'>) {
  const { field, fieldState } = useController<TValues, TName>({ name })
  return (
    <Field
      {...(label === undefined ? {} : { label })}
      {...(description === undefined ? {} : { description })}
      {...(info === undefined ? {} : { info })}
      {...(required === undefined ? {} : { required })}
      {...(span === undefined ? {} : { span })}
      {...(disabled === undefined ? {} : { disabled })}
      {...(asFieldset === undefined ? {} : { asFieldset })}
      error={fieldState.error?.message}
    >
      {children(field)}
    </Field>
  )
}

/** The buttons at the end of a form. Primary action last, on the right. */
export function FormActions({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('mt-6 flex flex-wrap items-center justify-end gap-2.5', className)}>{children}</div>
  )
}

/**
 * Put a rejected request's field errors back on the fields that caused them,
 * and return anything left over as one message for a banner. The first field
 * put back gets focus, as a failed client-side check does.
 *
 * Server validation is authoritative: the schema in the browser is there to
 * save a round trip, not to decide (docs/SECURITY.md §7).
 */
export function applyServerErrors<TValues extends FieldValues>(
  form: UseFormReturn<TValues>,
  error: unknown,
): string | null {
  if (!isApiError(error)) return 'Something went wrong. Please try again.'
  if (error.kind !== 'validation') return null

  const known = new Set(Object.keys(form.getValues()))
  const unmatched: string[] = []
  let focused = false
  for (const fieldError of error.fieldErrors) {
    const path = fieldError.path.split('.')[0]
    if (path !== undefined && known.has(path)) {
      // The server sends a path as a string; it is checked against the form's
      // own keys on the line above, which is as much as a type can be narrowed
      // from runtime data.
      form.setError(
        fieldError.path as FieldPath<TValues>,
        { type: 'server', message: fieldError.message },
        { shouldFocus: !focused },
      )
      focused = true
    } else {
      unmatched.push(fieldError.message)
    }
  }
  return unmatched.length > 0 ? unmatched.join(' ') : null
}
