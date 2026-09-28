import { Select } from '@/components/ui/Select'
import { usePractices } from '../queries/use-practices'

/**
 * Choose a practice — the one control every practice-scoped screen uses for a
 * `practice_id` (a referring physician today; providers, insurances … later),
 * fed by the practices list, never by hard-coded ids. Its value is the id as a
 * string, as the kit's Select holds it; `null` is none chosen.
 *
 * Every practice is offered. An inactive one says so, but is not hidden or
 * refused: what an inactive practice may still be used for is not decided
 * (Q-068).
 */
export function PracticeSelect({
  value,
  onChange,
  placeholder = 'Select a practice',
  clearable = false,
  disabled = false,
  className,
  'aria-label': ariaLabel,
}: {
  value: string | null
  onChange: (value: string | null) => void
  placeholder?: string
  clearable?: boolean
  disabled?: boolean
  className?: string
  /** Only when there is no Field label around it, e.g. in a filter bar. */
  'aria-label'?: string
}) {
  const practices = usePractices()
  const options = (practices.data ?? []).map((practice) => ({
    value: String(practice.id),
    label: practice.isActive ? practice.name : `${practice.name} (inactive)`,
  }))
  return (
    <Select
      value={value}
      onChange={onChange}
      options={options}
      placeholder={
        practices.isPending
          ? 'Loading practices…'
          : practices.isError
            ? 'Practices could not be loaded'
            : placeholder
      }
      clearable={clearable}
      disabled={disabled || !practices.isSuccess}
      {...(className === undefined ? {} : { className })}
      {...(ariaLabel === undefined ? {} : { 'aria-label': ariaLabel })}
    />
  )
}
