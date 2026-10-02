import { useId, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { InfoTip } from './InfoTip'

/**
 * An on/off control for a boolean state — by project convention, every
 * `is_active` field (docs/UI_KIT.md § Conventions). On is Active, off is
 * Inactive; the switch only sets the boolean and implies nothing else.
 *
 * A real `<button role="switch">`: Space and Enter toggle it, it takes focus,
 * and `aria-checked` announces the state. Its visible label is a `<label>`
 * for the button, so clicking the words toggles it too. "On" is shown three
 * ways — colour, thumb position and a check mark — so it never rests on colour
 * alone.
 */
export interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  /** Names the switch. Keep it stable ("Active"); the state is announced separately. */
  label: ReactNode
  /** Secondary line under the label. */
  description?: ReactNode
  /**
   * Optional context, shown on demand from an info icon beside the label —
   * the same field-note convention as `Field`'s `info` (docs/UI_KIT.md).
   */
  info?: ReactNode
  disabled?: boolean
  name?: string
  onBlur?: () => void
  className?: string
}

export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  info,
  disabled = false,
  name,
  onBlur,
  className,
}: SwitchProps) {
  const id = useId()
  const descriptionId = `${id}-description`
  return (
    <div className={cn('flex items-start gap-3', disabled && 'opacity-60', className)}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        {...(description === undefined ? {} : { 'aria-describedby': descriptionId })}
        {...(name === undefined ? {} : { name })}
        disabled={disabled}
        onBlur={onBlur}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          // The after: box widens the hit area to a comfortable touch target
          // without changing the drawn size.
          'relative inline-flex h-5 w-9 flex-none items-center rounded-full transition-colors duration-150',
          "after:absolute after:-inset-x-1.5 after:-inset-y-3 after:content-['']",
          'disabled:cursor-not-allowed',
          // n400 rather than n300 for the off track: a control's shape needs 3:1 against white.
          checked ? 'bg-brand' : 'bg-n400',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'bg-canvas grid size-4 place-items-center rounded-full transition-transform duration-150',
            checked ? 'translate-x-4.5' : 'translate-x-0.5',
          )}
        >
          {checked && <Check size={11} strokeWidth={3.25} className="text-brand" />}
        </span>
      </button>
      <span className="leading-tight">
        <label
          htmlFor={id}
          className={cn('text-meta text-ink', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}
        >
          {label}
        </label>
        {/* Beside the label, never inside it: inside, its name would join the switch's. */}
        {info !== undefined && (
          <span className="ml-1 inline-flex align-middle">
            <InfoTip label={typeof label === 'string' ? `About ${label}` : 'More information'}>
              {info}
            </InfoTip>
          </span>
        )}
        {description !== undefined && (
          <span id={descriptionId} className="text-micro text-n500 mt-0.5 block">
            {description}
          </span>
        )}
      </span>
    </div>
  )
}
