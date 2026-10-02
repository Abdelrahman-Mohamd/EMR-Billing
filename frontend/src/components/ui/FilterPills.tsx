import { cn } from '@/lib/utils/cn'

/**
 * A row of toggle pills that filters a list — the prototype's pill filter
 * (audit modules, hold reasons, exception levels, payment kinds). Any number
 * can be on; none on means "no filter". Each pill is a real button with
 * `aria-pressed`, so its state is announced, and "on" is shown by fill,
 * outline and a darker label, never by colour alone.
 *
 * The row wraps; it never scrolls sideways or pushes the page wider.
 */
export interface FilterPillOption {
  value: string
  label: string
  /** How many items the pill would show, after the label — as the prototype's payload log has it. */
  count?: number
}

export function FilterPills({
  options,
  selected,
  onChange,
  label,
  className,
}: {
  options: readonly FilterPillOption[]
  selected: readonly string[]
  /** The new selection, in the options' order. */
  onChange: (selected: string[]) => void
  /** Names the group for assistive technology, e.g. "Filter by module". */
  label: string
  className?: string
}) {
  const toggle = (value: string) => {
    const next = selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]
    onChange(options.map((option) => option.value).filter((item) => next.includes(item)))
  }
  return (
    <div role="group" aria-label={label} className={cn('flex flex-wrap gap-2', className)}>
      {options.map((option) => {
        const on = selected.includes(option.value)
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(option.value)}
            className={cn(
              'h-control-sm text-micro inline-flex items-center rounded-full px-3 font-medium transition-colors duration-100',
              on
                ? 'bg-brand-wash text-brand-deep shadow-[inset_0_0_0_1px_var(--color-brand-line)]'
                : 'bg-canvas text-n600 hover:bg-n50 hover:text-ink shadow-[inset_0_0_0_1px_var(--color-rule-structural)]',
            )}
          >
            {option.label}
            {/* The space keeps "Accepted 6" two words for a screen reader; a flex row does not draw it. */}
            {option.count !== undefined && ' '}
            {option.count !== undefined && (
              <span className={cn('ml-1.5 font-medium tabular-nums', on ? 'text-brand-deep' : 'text-n400')}>
                {option.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
