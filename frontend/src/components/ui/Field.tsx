import { createContext, useContext, useId, type ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'
import { InfoTip } from './InfoTip'

/**
 * Label, description and error for one control, wired together so a screen
 * reader gets the same information a sighted user does.
 *
 * Controls read this through context (`useFieldControl`), so the common case
 * needs no wiring at the call site:
 *
 *   <Field label="Member ID" required error={errors.memberId}>
 *     <Input />
 *   </Field>
 */
interface FieldContextValue {
  id: string
  /** Set when there is a label; a control that `<label for>` cannot name
   *  (anything that is not a native form element) points at it instead. */
  labelId: string | undefined
  describedBy: string | undefined
  invalid: boolean
  required: boolean
  disabled: boolean
}

const FieldContext = createContext<FieldContextValue | null>(null)

export interface FieldProps {
  label?: ReactNode
  /**
   * Text under the control that the user needs to complete the field — a
   * required format, a warning that changes what they type. Always visible.
   * Optional context (what a field means, where it is used) goes in `info`.
   */
  description?: ReactNode
  /**
   * Optional context, shown on demand from an info icon beside the label
   * (docs/UI_KIT.md § Conventions). Keeps the form free of loose notes.
   */
  info?: ReactNode
  /** Present means invalid. The control turns red and the message is announced. */
  error?: string | undefined
  required?: boolean
  disabled?: boolean
  /** Columns in a 12-column FormGrid. Ignored outside one. */
  span?: 3 | 4 | 6 | 8 | 9 | 12
  /**
   * Render as a fieldset with a legend instead of a label pointing at one
   * control. Required for a group of controls (radios, a set of checkboxes):
   * a `<label>` may only name a single control.
   */
  asFieldset?: boolean
  className?: string
  children: ReactNode
}

const SPAN: Record<NonNullable<FieldProps['span']>, string> = {
  3: 'sm:col-span-3',
  4: 'sm:col-span-4',
  6: 'sm:col-span-6',
  8: 'sm:col-span-8',
  9: 'sm:col-span-9',
  12: 'sm:col-span-12',
}

export function Field({
  label,
  description,
  info,
  error,
  required = false,
  disabled = false,
  span = 12,
  asFieldset = false,
  className,
  children,
}: FieldProps) {
  const id = useId()
  const errorId = `${id}-error`
  const descriptionId = `${id}-description`
  const labelId = `${id}-label`
  const invalid = error !== undefined && error !== ''

  // The error comes first: it is the part a user needs read back immediately.
  const describedBy =
    [invalid ? errorId : null, description ? descriptionId : null].filter(Boolean).join(' ') || undefined

  // n500, not n400: at 14px uppercase a label must clear 4.5:1 on white.
  const labelClass =
    'inline-flex items-center gap-1.5 text-micro font-medium uppercase leading-tight text-n500'
  const star = required && (
    <span className="text-critical" aria-hidden="true">
      *
    </span>
  )
  const tip =
    info === undefined ? null : (
      <InfoTip label={typeof label === 'string' ? `About ${label}` : 'More information'}>{info}</InfoTip>
    )
  // The info button sits beside the label, never inside it: inside, its name
  // would become part of the field's name ("Tax ID About Tax ID"). A legend
  // must stay the fieldset's first child, so there the group is named from
  // the label text alone with aria-labelledby.
  const heading =
    label === undefined ? null : asFieldset ? (
      <legend className={labelClass}>
        <span id={labelId}>{label}</span>
        {star}
        {tip}
      </legend>
    ) : tip === null ? (
      <label id={labelId} htmlFor={id} className={labelClass}>
        {label}
        {star}
      </label>
    ) : (
      <div className="flex items-center gap-1.5">
        <label id={labelId} htmlFor={id} className={labelClass}>
          {label}
          {star}
        </label>
        {tip}
      </div>
    )
  const Wrapper = asFieldset ? 'fieldset' : 'div'

  return (
    <FieldContext.Provider
      value={{
        id,
        labelId: label === undefined ? undefined : labelId,
        describedBy,
        invalid,
        required,
        disabled,
      }}
    >
      <Wrapper
        {...(asFieldset && label !== undefined ? { 'aria-labelledby': labelId } : {})}
        className={cn(
          'col-span-12 flex min-w-0 flex-col gap-2',
          asFieldset && 'border-0 p-0',
          SPAN[span],
          disabled && 'opacity-55',
          className,
        )}
      >
        {heading}
        {children}
        {invalid && (
          // Announced without stealing focus; the control already points here.
          <p id={errorId} role="alert" className="text-micro text-critical leading-snug">
            {error}
          </p>
        )}
        {description !== undefined && (
          <p id={descriptionId} className="text-micro text-n500 leading-snug">
            {description}
          </p>
        )}
      </Wrapper>
    </FieldContext.Provider>
  )
}

/**
 * Props a control spreads to join its Field. Outside a Field it returns a
 * generated id, so a bare control is still valid HTML.
 */
export function useFieldControl(): {
  id: string
  /** For controls a `<label for>` cannot name: a div with role="combobox". */
  labelId: string | undefined
  'aria-describedby'?: string
  'aria-invalid'?: true
  required?: true
  disabled?: true
  invalid: boolean
} {
  const field = useContext(FieldContext)
  const fallbackId = useId()
  if (!field) return { id: fallbackId, labelId: undefined, invalid: false }
  return {
    id: field.id,
    labelId: field.labelId,
    invalid: field.invalid,
    ...(field.describedBy === undefined ? {} : { 'aria-describedby': field.describedBy }),
    ...(field.invalid ? { 'aria-invalid': true as const } : {}),
    ...(field.required ? { required: true as const } : {}),
    ...(field.disabled ? { disabled: true as const } : {}),
  }
}

/** The 12-column form layout from the approved design. */
export function FormGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-12 gap-x-4 gap-y-[18px]', className)}>{children}</div>
}

/** A titled group inside a form. The first one carries no rule above it. */
export function FormSection({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <>
      <h3 className="border-rule-row text-row text-ink col-span-12 mt-1.5 border-t pt-3.5 font-medium first:mt-0 first:border-t-0 first:pt-0">
        {title}
      </h3>
      {children}
    </>
  )
}

/** A line of explanation spanning the whole form width. */
export function FormNote({ children }: { children: ReactNode }) {
  return <p className="text-micro text-n500 col-span-12 leading-relaxed">{children}</p>
}
