import { useState } from 'react'
import { cn } from '@/lib/utils/cn'
import { clockText, parseClock, toTimeParts } from '@/lib/utils/time'
import { FieldPart, useFieldControl } from './Field'
import { controlClass } from './Input'
import { Select } from './Select'

/**
 * The product's time field: the time typed ("6:07") and AM / PM picked from a
 * dropdown beside it (user, 2026-10-22). Any minute can be typed. It also
 * takes "607", "6" (on the hour) and the 24-hour clock ("18:07"), whose hour
 * sets AM / PM itself.
 *
 * The value is always a 24-hour `HH:MM` string ("18:07"); '' while what is
 * typed is not a time yet, so the form's own check says so. What was typed
 * stays in the box until it is a time; then the box shows it tidied ("6:07").
 * The field's label names the box; the dropdown names itself (AM or PM).
 */
export interface TimeInputProps {
  /** "HH:MM", 24-hour. Empty string means no time (yet). */
  value: string
  onChange: (time: string) => void
  onBlur?: (() => void) | undefined
  disabled?: boolean | undefined
  className?: string | undefined
}

type Period = 'AM' | 'PM'

export function TimeInput({ value, onChange, onBlur, disabled: disabledProp, className }: TimeInputProps) {
  const { invalid, id, labelId: _labelId, ...aria } = useFieldControl()
  const disabled = disabledProp ?? aria.disabled ?? false
  const parts = toTimeParts(value)
  /** What the user is typing. Null means "show the value". */
  const [draft, setDraft] = useState<string | null>(null)
  /** The period chosen while no time is typed yet; a time's own period wins. */
  const [chosenPeriod, setChosenPeriod] = useState<Period>('AM')
  const period: Period = parts === null ? chosenPeriod : parts.pm ? 'PM' : 'AM'

  return (
    <div className={cn('flex gap-2', className)}>
      <div className={controlClass(invalid, disabled, 'min-w-0 flex-1')}>
        <input
          {...aria}
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="Enter time"
          disabled={disabled}
          value={draft ?? clockText(value)}
          onChange={(event) => {
            setDraft(event.target.value)
            const time = parseClock(event.target.value, period === 'PM')
            // A 24-hour time ("18:07") says its own period: the dropdown follows it.
            if (time !== null) setChosenPeriod(toTimeParts(time)?.pm === true ? 'PM' : 'AM')
            onChange(time ?? '')
          }}
          onBlur={() => {
            // Tidied once it is a time; left as typed, to be fixed, until then.
            if (parts !== null) setDraft(null)
            onBlur?.()
          }}
          className="text-meta text-ink placeholder:text-n500 disabled:text-n400 h-full min-w-0 flex-1 border-0 bg-transparent tabular-nums outline-none"
        />
      </div>
      <FieldPart>
        <Select
          aria-label="AM or PM"
          value={period}
          onChange={(next) => {
            if (next !== 'AM' && next !== 'PM') return
            setChosenPeriod(next)
            if (parts !== null) onChange(parseClock(clockText(value), next === 'PM') ?? '')
          }}
          options={[
            { value: 'AM', label: 'AM' },
            { value: 'PM', label: 'PM' },
          ]}
          disabled={disabled}
          // Narrow: never cleared, so no room is kept for a clear button.
          className="w-[84px] flex-none pr-9"
        />
      </FieldPart>
    </div>
  )
}
