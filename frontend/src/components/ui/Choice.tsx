import { useEffect, useRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'
import { useFieldControl } from './Field'

/**
 * Checkbox and radio use the real elements, styled on the element itself
 * (see styles/index.css). That keeps keyboard behaviour, the indeterminate
 * state and screen-reader announcement, none of which a div can fake.
 */

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode
  /** Secondary line under the label. */
  description?: ReactNode
  /** Visually and semantically "partly checked" — for a select-all over a partial selection. */
  indeterminate?: boolean
}

export function Checkbox({ label, description, indeterminate = false, className, ...rest }: CheckboxProps) {
  const ref = useRef<HTMLInputElement>(null)

  // `indeterminate` exists only as a DOM property, so it cannot be set in JSX.
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])

  return (
    <label
      className={cn(
        'text-meta text-ink flex cursor-pointer items-start gap-2.5 leading-tight',
        rest.disabled && 'cursor-not-allowed opacity-60',
        className,
      )}
    >
      <input ref={ref} type="checkbox" className="mt-0.5" {...rest} />
      <span>
        {label}
        {description !== undefined && (
          <span className="text-micro text-n500 mt-0.5 block">{description}</span>
        )}
      </span>
    </label>
  )
}

export interface RadioOption<T extends string> {
  value: T
  label: ReactNode
  description?: ReactNode
  disabled?: boolean
}

export interface RadioGroupProps<T extends string> {
  /** Shared across the group; browsers use it for arrow-key navigation. */
  name: string
  value: T | undefined
  onValueChange: (value: T) => void
  options: readonly RadioOption<T>[]
  disabled?: boolean
  className?: string
}

/**
 * Wrap in `<Field asFieldset label="…">` so the group gets a legend: a
 * `<label>` may only name one control, never a set of them.
 */
export function RadioGroup<T extends string>({
  name,
  value,
  onValueChange,
  options,
  disabled = false,
  className,
}: RadioGroupProps<T>) {
  const { invalid, labelId: _labelId, ...aria } = useFieldControl()
  return (
    <div
      role="radiogroup"
      {...(aria['aria-describedby'] === undefined ? {} : { 'aria-describedby': aria['aria-describedby'] })}
      {...(invalid ? { 'aria-invalid': true as const } : {})}
      // Each option row is its own tap target, at least 32px tall: the rows
      // carry the spacing, so the group's gap is small.
      className={cn('flex flex-col gap-1', className)}
    >
      {options.map((option) => (
        <label
          key={option.value}
          className={cn(
            'text-meta text-ink flex min-h-8 cursor-pointer items-start gap-2.5 py-1.5 leading-tight',
            (disabled || option.disabled) && 'cursor-not-allowed opacity-60',
          )}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            disabled={disabled || option.disabled}
            onChange={() => onValueChange(option.value)}
            className="mt-0.5"
          />
          <span>
            {option.label}
            {option.description !== undefined && (
              <span className="text-micro text-n500 mt-0.5 block">{option.description}</span>
            )}
          </span>
        </label>
      ))}
    </div>
  )
}
