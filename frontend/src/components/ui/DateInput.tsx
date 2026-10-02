import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useFieldControl } from './Field'
import { controlClass } from './Input'

/**
 * The product's date field: a typed date plus a calendar, both styled by us.
 *
 * The value is always an ISO `YYYY-MM-DD` string — the shape the API will use —
 * while the box shows and accepts MM/DD/YYYY, which is how the prototype and
 * every claim form in this product write a date.
 *
 * It holds no business rules. "The end date must follow the start date", "a
 * hold may not start in the past" and the rest belong to the form schema;
 * `min` and `max` only stop the calendar from offering a day.
 */
export interface DateInputProps {
  /** ISO date, e.g. "2026-09-30". Empty string means no date. */
  value: string
  onChange: (isoDate: string) => void
  onBlur?: (() => void) | undefined
  /** Earliest selectable ISO date. */
  min?: string | undefined
  /** Latest selectable ISO date. */
  max?: string | undefined
  disabled?: boolean | undefined
  className?: string | undefined
  'aria-label'?: string | undefined
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
/** Years shown at once behind the caption. Twelve matches the month grid. */
const YEARS_PER_PAGE = 12
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/**
 * ISO to a local Date, parsed by hand: `new Date('2026-09-30')` is UTC
 * midnight, which is the day before in half the world.
 */
export function parseIso(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null
}

export function toIso(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** ISO to MM/DD/YYYY, for display. */
function toDisplay(iso: string): string {
  const date = parseIso(iso)
  if (!date) return ''
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${month}/${day}/${date.getFullYear()}`
}

/** MM/DD/YYYY (or M/D/YY) to ISO, or null when it is not a date yet. */
function fromDisplay(text: string): string | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(text.trim())
  if (!match) return null
  const rawYear = Number(match[3])
  const date = new Date(rawYear < 100 ? 2000 + rawYear : rawYear, Number(match[1]) - 1, Number(match[2]))
  return Number.isNaN(date.getTime()) ? null : toIso(date)
}

const addDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
const addMonths = (date: Date, months: number) =>
  new Date(date.getFullYear(), date.getMonth() + months, date.getDate())
const sameDay = (a: Date, b: Date) => toIso(a) === toIso(b)

export function DateInput({
  value,
  onChange,
  onBlur,
  min,
  max,
  disabled: disabledProp,
  className,
  'aria-label': ariaLabel,
}: DateInputProps) {
  const { invalid, id, labelId: _labelId, ...aria } = useFieldControl()
  const disabled = disabledProp ?? aria.disabled ?? false
  const [open, setOpen] = useState(false)
  /** What the user is typing. Null means "show the value". */
  const [draft, setDraft] = useState<string | null>(null)
  const [focusedDate, setFocusedDate] = useState<Date>(() => parseIso(value) ?? new Date())
  /**
   * Days is the calendar; months and years are the shortcuts behind the
   * caption, so a date three years out is two clicks away instead of thirty-six.
   */
  const [view, setView] = useState<'days' | 'months' | 'years'>('days')
  const gridRef = useRef<HTMLTableElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const selected = parseIso(value)
  const minDate = min === undefined ? null : parseIso(min)
  const maxDate = max === undefined ? null : parseIso(max)
  const outOfRange = (date: Date) =>
    (minDate !== null && toIso(date) < toIso(minDate)) || (maxDate !== null && toIso(date) > toIso(maxDate))

  // Keeping focus on the cell the arrow keys moved to is an imperative DOM
  // action, which is what an effect is for. (Opening is handled on the panel.)
  useEffect(() => {
    if (!open) return
    panelRef.current?.querySelector<HTMLButtonElement>('[data-focused="true"]')?.focus()
  }, [open, focusedDate, view])

  const choose = (date: Date) => {
    if (outOfRange(date)) return
    onChange(toIso(date))
    setDraft(null)
    setOpen(false)
  }

  /** Arrows in the month grid (3 across) and the year grid (3 across). */
  const onChooserKeyDown = (event: KeyboardEvent<HTMLDivElement>, step: 'month' | 'year') => {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 }
    const move = moves[event.key]
    if (move !== undefined) {
      event.preventDefault()
      setFocusedDate((current) =>
        step === 'month' ? addMonths(current, move) : addMonths(current, move * 12),
      )
      return
    }
  }

  const onGridKeyDown = (event: KeyboardEvent<HTMLTableElement>) => {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
    const move = moves[event.key]
    if (move !== undefined) {
      event.preventDefault()
      setFocusedDate((current) => addDays(current, move))
      return
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      const offset = event.key === 'Home' ? -focusedDate.getDay() : 6 - focusedDate.getDay()
      setFocusedDate((current) => addDays(current, offset))
      return
    }
    if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault()
      const step = event.key === 'PageUp' ? -1 : 1
      setFocusedDate((current) => addMonths(current, event.shiftKey ? step * 12 : step))
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      choose(focusedDate)
    }
  }

  /** A month is out of reach when every one of its days is. */
  const monthOutOfRange = (year: number, month: number) => {
    const first = new Date(year, month, 1)
    const last = new Date(year, month + 1, 0)
    return (
      (minDate !== null && toIso(last) < toIso(minDate)) ||
      (maxDate !== null && toIso(first) > toIso(maxDate))
    )
  }
  const yearOutOfRange = (year: number) =>
    (minDate !== null && year < minDate.getFullYear()) || (maxDate !== null && year > maxDate.getFullYear())

  const yearPageStart = Math.floor(focusedDate.getFullYear() / YEARS_PER_PAGE) * YEARS_PER_PAGE

  // Six weeks from the Sunday on or before the 1st: one stable grid height.
  const monthStart = new Date(focusedDate.getFullYear(), focusedDate.getMonth(), 1)
  const gridStart = addDays(monthStart, -monthStart.getDay())
  const weeks = Array.from({ length: 6 }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => addDays(gridStart, week * 7 + day)),
  )
  const today = new Date()

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          setFocusedDate(parseIso(value) ?? new Date())
          setView('days')
        }
      }}
    >
      <div className={controlClass(invalid, disabled, cn('pr-1', className))}>
        <input
          {...aria}
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="MM/DD/YYYY"
          aria-label={ariaLabel}
          disabled={disabled}
          value={draft ?? toDisplay(value)}
          onChange={(event) => {
            setDraft(event.target.value)
            const iso = fromDisplay(event.target.value)
            if (iso !== null) onChange(iso)
            else if (event.target.value.trim() === '') onChange('')
          }}
          onBlur={() => {
            // Snap back to the canonical spelling of whatever was understood.
            setDraft(null)
            onBlur?.()
          }}
          className="text-meta text-ink placeholder:text-n500 disabled:text-n400 h-full min-w-0 flex-1 border-0 bg-transparent outline-none"
        />
        <Popover.Trigger asChild disabled={disabled}>
          <button
            type="button"
            aria-label="Choose a date from the calendar"
            disabled={disabled}
            className="text-n500 hover:bg-n50 hover:text-brand relative grid size-7 flex-none place-items-center rounded-sm after:absolute after:-inset-1.5 after:content-['']"
          >
            <CalendarDays size={16} aria-hidden="true" />
          </button>
        </Popover.Trigger>
      </div>

      <Popover.Portal>
        <Popover.Content
          ref={panelRef}
          align="start"
          sideOffset={6}
          role="dialog"
          aria-label="Choose a date"
          onOpenAutoFocus={(event) => {
            // The grid takes focus, not the arrows, and it is taken here, where
            // the panel is certainly mounted.
            event.preventDefault()
            panelRef.current?.querySelector<HTMLButtonElement>('[data-focused="true"]')?.focus()
          }}
          onEscapeKeyDown={(event) => {
            // Escape inside the month or year chooser goes back to the calendar;
            // only the calendar itself closes the picker. Radix listens on the
            // document, so this has to be handled here, not on the grid.
            if (view !== 'days') {
              event.preventDefault()
              setView('days')
            }
          }}
          onCloseAutoFocus={() => setView('days')}
          className="rounded-card bg-canvas shadow-popover ring-n200 animate-pop-in z-[70] w-[272px] p-3 ring-1"
        >
          {/* Header: step by one, or jump straight to a month or a year. */}
          <div className="mb-2 flex items-center gap-1">
            <button
              type="button"
              aria-label={
                view === 'days' ? 'Previous month' : view === 'months' ? 'Previous year' : 'Earlier years'
              }
              onClick={() =>
                setFocusedDate((current) =>
                  addMonths(current, view === 'days' ? -1 : view === 'months' ? -12 : -12 * YEARS_PER_PAGE),
                )
              }
              className="text-n500 hover:bg-n50 hover:text-ink relative grid size-7 flex-none place-items-center rounded-sm after:absolute after:-inset-1.5 after:content-['']"
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>

            {view === 'years' ? (
              <span aria-live="polite" className="text-meta text-ink flex-1 text-center font-medium">
                {yearPageStart}&ndash;{yearPageStart + YEARS_PER_PAGE - 1}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setView(view === 'days' ? 'months' : 'years')}
                aria-expanded={view !== 'days'}
                aria-label={view === 'days' ? 'Choose a month or year' : 'Choose a year'}
                className="text-meta text-ink hover:bg-n50 relative flex flex-1 items-center justify-center gap-1 rounded-sm py-1 font-medium after:absolute after:inset-x-0 after:-inset-y-1 after:content-['']"
              >
                <span aria-live="polite">
                  {view === 'days'
                    ? `${MONTHS[focusedDate.getMonth()]} ${focusedDate.getFullYear()}`
                    : focusedDate.getFullYear()}
                </span>
                <ChevronDown size={14} aria-hidden="true" className="text-n500" />
              </button>
            )}

            <button
              type="button"
              aria-label={view === 'days' ? 'Next month' : view === 'months' ? 'Next year' : 'Later years'}
              onClick={() =>
                setFocusedDate((current) =>
                  addMonths(current, view === 'days' ? 1 : view === 'months' ? 12 : 12 * YEARS_PER_PAGE),
                )
              }
              className="text-n500 hover:bg-n50 hover:text-ink relative grid size-7 flex-none place-items-center rounded-sm after:absolute after:-inset-1.5 after:content-['']"
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>

          {view === 'days' && (
            <table
              ref={gridRef}
              role="grid"
              aria-label={`${MONTHS[focusedDate.getMonth()]} ${focusedDate.getFullYear()}`}
              onKeyDown={onGridKeyDown}
              className="w-full border-separate border-spacing-0.5"
            >
              <thead>
                <tr>
                  {WEEKDAYS.map((weekday) => (
                    <th
                      key={weekday}
                      scope="col"
                      abbr={weekday}
                      className="text-eyebrow text-n500 size-8 font-medium"
                    >
                      {weekday}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeks.map((week) => (
                  <tr key={toIso(week[0]!)}>
                    {week.map((date) => {
                      const isSelected = selected !== null && sameDay(date, selected)
                      const isFocused = sameDay(date, focusedDate)
                      const isToday = sameDay(date, today)
                      const outside = date.getMonth() !== focusedDate.getMonth()
                      const blocked = outOfRange(date)
                      return (
                        <td key={toIso(date)} className="p-0">
                          <button
                            type="button"
                            // Roving tabindex: the grid is one tab stop.
                            tabIndex={isFocused ? 0 : -1}
                            data-focused={isFocused}
                            aria-selected={isSelected}
                            aria-current={isToday ? 'date' : undefined}
                            disabled={blocked}
                            onClick={() => choose(date)}
                            onFocus={() => setFocusedDate(date)}
                            className={cn(
                              'text-micro grid size-8 place-items-center rounded-sm',
                              outside ? 'text-n400' : 'text-ink',
                              isToday && !isSelected && 'ring-brand-line font-medium ring-1',
                              isSelected && 'bg-brand font-medium text-white',
                              !isSelected && !blocked && 'hover:bg-n50',
                              blocked && 'text-n300 cursor-not-allowed line-through',
                            )}
                          >
                            {date.getDate()}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {view === 'months' && (
            <div
              role="grid"
              aria-label={`Months in ${focusedDate.getFullYear()}`}
              onKeyDown={(event) => onChooserKeyDown(event, 'month')}
              className="grid grid-cols-3 gap-1"
            >
              {MONTHS.map((month, index) => {
                const isFocused = index === focusedDate.getMonth()
                const isSelected =
                  selected !== null &&
                  selected.getFullYear() === focusedDate.getFullYear() &&
                  selected.getMonth() === index
                const blocked = monthOutOfRange(focusedDate.getFullYear(), index)
                return (
                  <button
                    key={month}
                    type="button"
                    tabIndex={isFocused ? 0 : -1}
                    data-focused={isFocused}
                    aria-selected={isSelected}
                    disabled={blocked}
                    onClick={() => {
                      setFocusedDate(new Date(focusedDate.getFullYear(), index, 1))
                      setView('days')
                    }}
                    className={cn(
                      'text-micro rounded-sm py-2',
                      isSelected ? 'bg-brand font-medium text-white' : 'text-ink hover:bg-n50',
                      blocked && 'text-n300 cursor-not-allowed hover:bg-transparent',
                    )}
                  >
                    {month.slice(0, 3)}
                  </button>
                )
              })}
            </div>
          )}

          {view === 'years' && (
            <div
              role="grid"
              aria-label={`Years ${yearPageStart} to ${yearPageStart + YEARS_PER_PAGE - 1}`}
              onKeyDown={(event) => onChooserKeyDown(event, 'year')}
              className="grid grid-cols-3 gap-1"
            >
              {Array.from({ length: YEARS_PER_PAGE }, (_, index) => yearPageStart + index).map((year) => {
                const isFocused = year === focusedDate.getFullYear()
                const isSelected = selected !== null && selected.getFullYear() === year
                const blocked = yearOutOfRange(year)
                return (
                  <button
                    key={year}
                    type="button"
                    tabIndex={isFocused ? 0 : -1}
                    data-focused={isFocused}
                    aria-selected={isSelected}
                    disabled={blocked}
                    onClick={() => {
                      setFocusedDate(new Date(year, focusedDate.getMonth(), 1))
                      setView('months')
                    }}
                    className={cn(
                      'text-micro rounded-sm py-2',
                      isSelected ? 'bg-brand font-medium text-white' : 'text-ink hover:bg-n50',
                      blocked && 'text-n300 cursor-not-allowed hover:bg-transparent',
                    )}
                  >
                    {year}
                  </button>
                )
              })}
            </div>
          )}

          <div className="border-rule-row mt-2 flex items-center justify-between border-t pt-2">
            <button
              type="button"
              onClick={() => {
                setView('days')
                choose(new Date())
              }}
              className="text-micro text-brand-deep hover:text-ink relative px-1 after:absolute after:-inset-x-1 after:-inset-y-2.5 after:content-['']"
            >
              Today
            </button>
            {value !== '' && (
              <button
                type="button"
                onClick={() => {
                  onChange('')
                  setOpen(false)
                }}
                className="text-micro text-n500 hover:text-ink relative px-1 after:absolute after:-inset-x-1 after:-inset-y-2.5 after:content-['']"
              >
                Clear
              </button>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

/**
 * Two dates that belong together. It enforces only the UI-level rule that the
 * end cannot precede the start; anything else is business logic.
 */
export function DateRangeInput({
  from,
  to,
  onFromChange,
  onToChange,
  disabled,
  className,
}: {
  from: string
  to: string
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
  disabled?: boolean | undefined
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <DateInput
        value={from}
        max={to === '' ? undefined : to}
        disabled={disabled}
        aria-label="From"
        onChange={onFromChange}
      />
      <span aria-hidden="true" className="text-micro text-n500 flex-none">
        to
      </span>
      <DateInput
        value={to}
        min={from === '' ? undefined : from}
        disabled={disabled}
        aria-label="To"
        onChange={onToChange}
      />
    </div>
  )
}
