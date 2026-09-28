import { Combobox, type ComboboxOption } from './Combobox'

/**
 * The product's dropdown for a short list. Styled, not native: the design puts
 * two-line options and a tick in the list, which a native `<select>` cannot
 * render, and a half-native/half-custom set of dropdowns would look like two
 * different products.
 *
 * Keyboard behaviour matches what a native control gives: Enter/Space/ArrowDown
 * open it, arrows and Home/End move, typing jumps to a match, Enter picks,
 * Escape closes. That lives once, in `Combobox`.
 *
 * Long list? Use `SearchSelect`, which adds a search box to the same panel.
 */
export type SelectOption = ComboboxOption

export interface SelectProps {
  options: readonly SelectOption[]
  value: string | null
  onChange: (value: string | null) => void
  /** Shown when nothing is chosen. */
  placeholder?: string
  /** Offer an explicit "clear" once something is chosen. */
  clearable?: boolean
  disabled?: boolean
  className?: string
  /** Accessible name when there is no Field label around the component. */
  'aria-label'?: string
}

export function Select({ value, onChange, clearable = false, ...rest }: SelectProps) {
  return (
    <Combobox
      {...rest}
      searchable={false}
      multiple={false}
      selected={value === null || value === '' ? [] : [value]}
      {...(clearable ? { onClear: () => onChange(null) } : {})}
      onSelect={(next) => onChange(next)}
    />
  )
}
