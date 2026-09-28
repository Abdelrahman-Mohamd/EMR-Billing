import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useFieldControl } from './Field'

/**
 * The control shell every input-like element wears: one height, one radius,
 * one focus ring. Exported so Select and the comboboxes look identical to an
 * Input without copying the classes.
 */
export function controlClass(invalid: boolean, disabled?: boolean, extra?: string): string {
  return cn(
    'relative flex h-control items-center gap-2.5 rounded-md bg-canvas px-3',
    'shadow-[inset_0_0_0_1px_var(--color-rule-structural)] transition-[box-shadow,background-color] duration-100',
    'hover:shadow-[inset_0_0_0_1px_var(--color-n300)]',
    'focus-within:bg-canvas focus-within:shadow-[inset_0_0_0_2px_var(--color-brand)]',
    invalid &&
      'shadow-[inset_0_0_0_1px_var(--color-critical)] focus-within:shadow-[inset_0_0_0_2px_var(--color-critical)]',
    disabled &&
      'bg-n50 text-n400 shadow-[inset_0_0_0_1px_var(--color-rule-row)] hover:shadow-[inset_0_0_0_1px_var(--color-rule-row)]',
    extra,
  )
}

/** The bare input inside the shell. */
const innerClass =
  'h-full min-w-0 flex-1 border-0 bg-transparent text-meta font-normal text-ink outline-none placeholder:text-n500 disabled:cursor-not-allowed disabled:text-n400'

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {
  /** Rendered inside the control, before the text. A 16px icon or a unit. */
  prefix?: ReactNode
  /** Rendered inside the control, after the text. */
  suffix?: ReactNode
  className?: string
}

export function Input({ prefix, suffix, className, readOnly, ...rest }: InputProps) {
  const { invalid, labelId: _labelId, ...aria } = useFieldControl()
  const disabled = rest.disabled ?? aria.disabled
  return (
    <div className={controlClass(invalid, disabled, cn(readOnly && 'bg-n50', className))}>
      {prefix !== undefined && <span className="text-n500 flex-none">{prefix}</span>}
      <input {...aria} {...rest} readOnly={readOnly} className={innerClass} />
      {suffix !== undefined && <span className="text-meta text-n500 flex-none">{suffix}</span>}
    </div>
  )
}

/** A text input that happens to search. Type is `search` so the browser offers to clear it. */
export function SearchInput({ placeholder = 'Search', ...rest }: InputProps) {
  return (
    <Input
      type="search"
      placeholder={placeholder}
      prefix={<Search size={16} aria-hidden="true" />}
      {...rest}
    />
  )
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string
}

export function Textarea({ className, rows = 3, ...rest }: TextareaProps) {
  const { invalid, labelId: _labelId, ...aria } = useFieldControl()
  const disabled = rest.disabled ?? aria.disabled
  return (
    <div className={controlClass(invalid, disabled, cn('h-auto items-stretch py-2.5', className))}>
      <textarea
        {...aria}
        {...rest}
        rows={rows}
        className={cn(innerClass, 'h-auto resize-y leading-relaxed')}
      />
    </div>
  )
}
