import { cn } from '@/lib/utils/cn'

/**
 * One choice out of a few, shown side by side — the prototype's segmented
 * control (a role's Edit / View / Hidden, view toggles).
 *
 * Real radio inputs underneath, visually hidden: the arrow keys move between
 * options, Tab enters and leaves the group as one stop, and a screen reader
 * announces "radio, 2 of 3, selected". The chosen option is shown by fill
 * and darker text, never by colour alone.
 */
export interface SegmentedOption<T extends string> {
  value: T
  label: string
}

export function SegmentedControl<T extends string>({
  name,
  label,
  value,
  options,
  onChange,
  disabled = false,
  className,
}: {
  /** Shared by the group's radios; must be unique on the page. */
  name: string
  /** Names the group for assistive technology, e.g. "Access to Billing". */
  label: string
  value: T
  options: readonly SegmentedOption<T>[]
  onChange: (value: T) => void
  disabled?: boolean
  className?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      {...(disabled ? { 'aria-disabled': true } : {})}
      className={cn(
        'bg-canvas inline-flex gap-0.5 rounded-md p-0.5 shadow-[inset_0_0_0_1px_var(--color-rule-structural)]',
        disabled && 'opacity-60',
        className,
      )}
    >
      {options.map((option) => (
        <label
          key={option.value}
          className={cn('relative', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            disabled={disabled}
            onChange={() => onChange(option.value)}
            className="peer sr-only"
          />
          <span
            className={cn(
              'text-meta grid h-8 min-w-14 place-items-center rounded-sm px-3 font-medium transition-colors duration-100',
              'peer-focus-visible:outline-brand peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1',
              value === option.value
                ? 'bg-brand-wash text-brand-deep'
                : cn('text-n500', !disabled && 'hover:bg-n50 hover:text-ink'),
            )}
          >
            {option.label}
          </span>
        </label>
      ))}
    </div>
  )
}
