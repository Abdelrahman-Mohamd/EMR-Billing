import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useFieldControl } from './Field'
import { controlClass } from './Input'

/**
 * The engine behind every dropdown in the product: `Select`, `SearchSelect`
 * and `MultiSelect` are three sets of props on this one component, so they
 * share their keyboard behaviour, their aria wiring and their look.
 *
 * Not a native `<select>`: the design calls for a styled list with two-line
 * options and chips, which a native control cannot render. That means the
 * keyboard behaviour a native control gives free has to be written here —
 * arrows, Home/End, type-ahead, Enter, Escape — and it is, once.
 *
 * It knows nothing about what it lists. Options come from the feature.
 */
export interface ComboboxOption {
  value: string
  label: string
  /** Second line under the label — a code, a legal name, a payer id. */
  description?: string
  disabled?: boolean
}

export interface ComboboxProps {
  options: readonly ComboboxOption[]
  selected: readonly string[]
  multiple: boolean
  /** Show a search box above the list. For lists longer than a screen. */
  searchable: boolean
  onSelect: (value: string) => void
  /** Single selection only: offers an explicit clear once something is chosen. */
  onClear?: (() => void) | undefined
  onRemove?: ((value: string) => void) | undefined
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  className?: string
  /** Accessible name when there is no Field label around the component. */
  'aria-label'?: string
}

/** How long a type-ahead sequence stays open before it starts again. */
const TYPEAHEAD_MS = 600

export function Combobox({
  options,
  selected,
  multiple,
  searchable,
  onSelect,
  onClear,
  onRemove,
  placeholder = 'Select…',
  searchPlaceholder = 'Search',
  emptyMessage = 'No match.',
  disabled: disabledProp,
  className,
  'aria-label': ariaLabel,
}: ComboboxProps) {
  const { invalid, id, labelId, ...aria } = useFieldControl()
  const disabled = disabledProp ?? aria.disabled ?? false
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const listId = `${id}-listbox`
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const typeahead = useRef({ text: '', at: 0 })

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((option) => `${option.label} ${option.description ?? ''}`.toLowerCase().includes(q))
  }, [options, query])

  const chosen = options.filter((option) => selected.includes(option.value))

  /** Open on the current selection, the way a native select does. */
  const indexOfSelection = () => {
    const index = options.findIndex((option) => selected.includes(option.value))
    return index < 0 ? 0 : index
  }

  const openPanel = () => {
    setActiveIndex(indexOfSelection())
    setOpen(true)
  }

  const commit = (option: ComboboxOption) => {
    if (option.disabled === true) return
    onSelect(option.value)
    if (!multiple) {
      setOpen(false)
      setQuery('')
    }
  }

  /** Arrow/Home/End/Enter, shared by the search box and the bare list. */
  const onListKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (visible.length === 0) return
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((current) => (current + step + visible.length) % visible.length)
      return
    }
    if (event.key === 'Home') {
      event.preventDefault()
      setActiveIndex(0)
      return
    }
    if (event.key === 'End') {
      event.preventDefault()
      setActiveIndex(Math.max(0, visible.length - 1))
      return
    }
    const typing = Date.now() - typeahead.current.at < TYPEAHEAD_MS
    if (event.key === 'Enter' || (event.key === ' ' && !searchable && !typing)) {
      event.preventDefault()
      const option = visible[activeIndex]
      if (option) commit(option)
      return
    }
    // Type-ahead, for the list with no search box: "no" jumps to Northbrook.
    if (!searchable && event.key.length === 1 && !event.metaKey && !event.ctrlKey) {
      const now = Date.now()
      const text =
        (now - typeahead.current.at < TYPEAHEAD_MS ? typeahead.current.text : '') + event.key.toLowerCase()
      typeahead.current = { text, at: now }
      const index = visible.findIndex((option) => option.label.toLowerCase().startsWith(text))
      if (index >= 0) setActiveIndex(index)
    }
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          setQuery('')
          setActiveIndex(0)
          return
        }
        setActiveIndex(indexOfSelection())
      }}
    >
      <Popover.Trigger asChild disabled={disabled}>
        {/*
          A div with role="combobox", not a <button>: the chips and the clear
          control are real buttons, and a button may not contain a button. The
          keyboard behaviour a button would have given us is added here.
        */}
        <div
          id={id}
          role="combobox"
          tabIndex={disabled ? -1 : 0}
          aria-expanded={open}
          aria-controls={listId}
          aria-haspopup="listbox"
          aria-label={ariaLabel}
          // A <label for> cannot name a div, so point at the label instead.
          aria-labelledby={ariaLabel === undefined ? labelId : undefined}
          aria-disabled={disabled || undefined}
          aria-required={aria.required}
          {...(aria['aria-describedby'] === undefined
            ? {}
            : { 'aria-describedby': aria['aria-describedby'] })}
          {...(invalid ? { 'aria-invalid': true as const } : {})}
          onKeyDown={(event) => {
            // Only the combobox itself opens the panel. A key pressed on a chip's
            // remove button or on the clear button bubbles up here and must keep
            // its own meaning.
            if (event.target !== event.currentTarget) return
            if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
              event.preventDefault()
              openPanel()
            }
          }}
          className={controlClass(
            invalid,
            disabled,
            cn('min-h-control h-auto cursor-pointer py-1.5 pr-14 text-left', className),
          )}
        >
          <span className="flex min-w-0 flex-wrap items-center gap-1.5 py-0.5">
            {chosen.length === 0 ? (
              <span className="text-meta text-n500">{placeholder}</span>
            ) : multiple ? (
              chosen.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  onRemove={onRemove ? () => onRemove(option.value) : undefined}
                />
              ))
            ) : (
              <span className="text-meta text-ink truncate">{chosen[0]?.label}</span>
            )}
          </span>
          {onClear && !multiple && chosen.length > 0 && (
            <button
              type="button"
              aria-label="Clear selection"
              disabled={disabled}
              className="text-n500 hover:bg-n200 hover:text-ink absolute right-8 grid size-5 place-items-center rounded-full after:absolute after:-inset-2 after:content-['']"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onClear()
              }}
            >
              <X size={13} aria-hidden="true" />
            </button>
          )}
          <ChevronDown
            size={14}
            aria-hidden="true"
            className="text-n400 pointer-events-none absolute right-3"
          />
        </div>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(event) => {
            // Focus the search box when there is one — typing is the point —
            // and otherwise the list itself, which owns the keys.
            event.preventDefault()
            if (searchable) searchRef.current?.focus()
            else listRef.current?.focus()
          }}
          className="rounded-card bg-canvas shadow-popover ring-n200 animate-pop-in z-[70] w-[var(--radix-popover-trigger-width)] p-2 ring-1"
        >
          {searchable && (
            <div className={controlClass(false, false, 'h-control-sm mb-2')}>
              <Search size={16} aria-hidden="true" className="text-n500 flex-none" />
              <input
                ref={searchRef}
                type="search"
                value={query}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                aria-controls={listId}
                aria-activedescendant={
                  visible[activeIndex] ? `${listId}-${visible[activeIndex].value}` : undefined
                }
                onChange={(event) => {
                  setQuery(event.target.value)
                  setActiveIndex(0)
                }}
                onKeyDown={onListKeyDown}
                className="text-meta text-ink placeholder:text-n500 h-full min-w-0 flex-1 border-0 bg-transparent outline-none"
              />
            </div>
          )}

          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-multiselectable={multiple}
            aria-label={searchable ? undefined : (ariaLabel ?? placeholder)}
            tabIndex={searchable ? undefined : -1}
            onKeyDown={searchable ? undefined : onListKeyDown}
            aria-activedescendant={
              !searchable && visible[activeIndex] ? `${listId}-${visible[activeIndex].value}` : undefined
            }
            className="max-h-56 overflow-y-auto outline-none"
          >
            {visible.length === 0 && <li className="text-micro text-n500 px-2 py-2">{emptyMessage}</li>}
            {visible.map((option, index) => {
              const isSelected = selected.includes(option.value)
              return (
                <li
                  key={option.value}
                  id={`${listId}-${option.value}`}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={option.disabled}
                  onClick={() => commit(option)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn(
                    'text-meta text-ink flex cursor-pointer items-start gap-2 rounded-sm px-2 py-1.5',
                    index === activeIndex && 'bg-n50',
                    isSelected && 'font-medium',
                    option.disabled === true && 'cursor-not-allowed opacity-50',
                  )}
                >
                  <Check
                    size={14}
                    aria-hidden="true"
                    className={cn('text-brand mt-1 flex-none', !isSelected && 'invisible')}
                  />
                  <span className="min-w-0">
                    {option.label}
                    {option.description !== undefined && (
                      <span className="text-micro text-n500 block truncate">{option.description}</span>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function Chip({ label, onRemove }: { label: string; onRemove?: (() => void) | undefined }) {
  return (
    <span className="text-eyebrow text-brand-deep bg-brand-wash ring-brand-line inline-flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2.5 leading-tight ring-1">
      {label}
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${label}`}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onRemove()
          }}
          className="text-n500 hover:bg-brand-line hover:text-ink grid size-4 cursor-pointer place-items-center rounded-full"
        >
          <X size={11} aria-hidden="true" />
        </button>
      )}
    </span>
  )
}
