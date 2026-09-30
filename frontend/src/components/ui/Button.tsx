import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'
import { Spinner } from './Spinner'

/**
 * The one button. Variants exist because the approved design uses them, not
 * because a library ships them.
 *
 * `danger` is the outlined form (a destructive action offered in a row or a
 * toolbar); `dangerFill` is the filled form, reserved for the confirming
 * button of a destructive dialog — so a filled red button always means
 * "this is the irreversible one".
 */
export type ButtonVariant = 'default' | 'primary' | 'quiet' | 'danger' | 'dangerFill'
export type ButtonSize = 'xs' | 'sm' | 'md'

const VARIANT: Record<ButtonVariant, string> = {
  default:
    'bg-canvas text-n600 shadow-[inset_0_0_0_1px_var(--color-rule-structural)] hover:bg-n50 hover:text-ink',
  primary: 'bg-brand text-white hover:bg-brand-hover',
  quiet: 'bg-transparent text-brand-deep hover:text-ink',
  danger: 'bg-canvas text-critical shadow-[inset_0_0_0_1px_var(--color-critical-line)] hover:bg-critical-bg',
  dangerFill: 'bg-critical text-white hover:bg-critical-deep',
}

const SIZE: Record<ButtonSize, string> = {
  xs: 'h-control-xs px-2.5',
  sm: 'h-control-sm px-3',
  md: 'h-control px-4',
}

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Shown before the label. Pass a 16px icon. */
  icon?: ReactNode
  /** Shown after the label. */
  iconAfter?: ReactNode
  /** Disables the button and swaps the leading icon for a spinner. */
  loading?: boolean
  block?: boolean
  children?: ReactNode
}

/** The shared look, so a router `<Link>` can wear it without becoming a button. */
export function buttonClass(
  variant: ButtonVariant = 'default',
  size: ButtonSize = 'md',
  extra?: string,
): string {
  return cn(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-[13px] font-medium no-underline',
    'transition-[background-color,color,box-shadow] duration-100',
    'disabled:cursor-not-allowed disabled:opacity-45 aria-disabled:cursor-not-allowed aria-disabled:opacity-45',
    VARIANT[variant],
    variant === 'quiet' ? 'px-2' : SIZE[size],
    variant === 'quiet'
      ? size === 'md'
        ? 'h-control'
        : size === 'sm'
          ? 'h-control-sm'
          : 'h-control-xs'
      : '',
    extra,
  )
}

export function Button({
  variant = 'default',
  size = 'md',
  icon,
  iconAfter,
  loading = false,
  block = false,
  className,
  disabled,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      // Buttons inside a form submit it by accident; opting in is explicit.
      type={type}
      disabled={disabled === true || loading}
      // Announce the wait, so a screen reader is not left on a silent button.
      aria-busy={loading || undefined}
      className={buttonClass(
        variant,
        size,
        cn(
          block && 'w-full',
          // An icon-only button is drawn small; its tap area is not: the
          // invisible box reaches 44px from a 28px button.
          icon !== undefined &&
            (children === undefined || children === null) &&
            "relative after:absolute after:-inset-2 after:content-['']",
          className,
        ),
      )}
      {...rest}
    >
      {loading ? <Spinner size={16} /> : icon}
      {children}
      {!loading && iconAfter}
    </button>
  )
}
