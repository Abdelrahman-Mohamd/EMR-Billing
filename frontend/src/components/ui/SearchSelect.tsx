import { Combobox, type ComboboxOption } from './Combobox'

/**
 * A dropdown that is searched rather than scrolled — the pattern the approved
 * prototype uses wherever a list is long (payers, practices, procedure codes).
 * For a short list, use `Select`.
 *
 * Single and multiple selection are the same component underneath (Combobox),
 * so adding multi-select to a screen is a prop, not a second widget with its
 * own bugs.
 */
export type SearchSelectOption = ComboboxOption

interface BaseProps {
  options: readonly SearchSelectOption[]
  placeholder?: string
  searchPlaceholder?: string
  /** Shown when the search matches nothing. */
  emptyMessage?: string
  disabled?: boolean
  className?: string
  /** Accessible name when there is no Field label around the component. */
  'aria-label'?: string
}

export interface SearchSelectProps extends BaseProps {
  value: string | null
  onChange: (value: string | null) => void
  /** Offer an explicit "clear" once something is chosen. */
  clearable?: boolean
}

export interface MultiSelectProps extends BaseProps {
  value: readonly string[]
  onChange: (value: string[]) => void
}

/** Single selection, searchable. */
export function SearchSelect({ value, onChange, clearable = false, ...rest }: SearchSelectProps) {
  return (
    <Combobox
      {...rest}
      searchable
      multiple={false}
      selected={value === null ? [] : [value]}
      {...(clearable ? { onClear: () => onChange(null) } : {})}
      onSelect={(next) => onChange(next)}
    />
  )
}

/** Multiple selection: chips in the box, the panel stays open while picking. */
export function MultiSelect({ value, onChange, ...rest }: MultiSelectProps) {
  return (
    <Combobox
      {...rest}
      searchable
      multiple
      selected={value}
      onSelect={(next) => {
        const set = new Set(value)
        if (set.has(next)) set.delete(next)
        else set.add(next)
        onChange([...set])
      }}
      onRemove={(item) => onChange(value.filter((v) => v !== item))}
    />
  )
}
