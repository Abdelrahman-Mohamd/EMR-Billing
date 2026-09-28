import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

/**
 * Tone is the vocabulary the whole product shares. It says how something
 * reads, never what it is: a feature decides that "Denied" is `critical`,
 * and this file never learns what a denial is.
 *
 * critical = blocking · warning = needs attention · attention = waiting, not wrong
 * success = done · info = context · inert = nothing to do · brand = selected
 */
export type Tone = 'critical' | 'warning' | 'attention' | 'success' | 'info' | 'inert' | 'brand'

const CHIP: Record<Tone, string> = {
  critical: 'bg-critical-bg text-critical',
  warning: 'bg-warning-bg text-warning',
  attention: 'bg-sand-wash text-sand-deep',
  success: 'bg-success-bg text-success',
  info: 'bg-info-bg text-info',
  inert: 'bg-n100 text-n500',
  brand: 'bg-brand-wash text-brand-deep',
}

const DOT: Record<Tone, string> = {
  critical: 'text-critical',
  warning: 'text-warning',
  attention: 'text-sand-deep',
  success: 'text-success',
  info: 'text-info',
  inert: 'text-n500',
  brand: 'text-brand',
}

/** A filled pill. Use for a status that should be findable while scanning a table. */
export function Badge({
  tone = 'inert',
  dot = true,
  children,
  className,
}: {
  tone?: Tone
  /** The leading dot. Off for a count or a label that is not a state. */
  dot?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'text-eyebrow inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] leading-tight font-semibold whitespace-nowrap',
        CHIP[tone],
        className,
      )}
    >
      {dot && <span aria-hidden="true" className="size-1.5 flex-none rounded-full bg-current" />}
      {children}
    </span>
  )
}

/** A quieter status: a coloured dot and a word, for inside a dense row. */
export function StatusDot({
  tone = 'inert',
  children,
  className,
}: {
  tone?: Tone
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'text-micro inline-flex items-center gap-[7px] font-medium whitespace-nowrap',
        DOT[tone],
        className,
      )}
    >
      <span aria-hidden="true" className="size-[7px] flex-none rounded-full bg-current" />
      {children}
    </span>
  )
}

/** A neutral label: a rule name, a category, a format. Not a state. */
export function Tag({
  tone = 'inert',
  children,
  className,
}: {
  tone?: Extract<Tone, 'inert' | 'brand' | 'attention'>
  children: ReactNode
  className?: string
}) {
  const style =
    tone === 'brand'
      ? 'bg-brand-wash text-brand-deep'
      : tone === 'attention'
        ? 'bg-sand-wash text-sand-deep'
        : 'bg-n100 text-n600'
  return (
    <span
      className={cn(
        'text-eyebrow inline-flex items-center gap-1 rounded-sm px-[7px] py-px font-medium whitespace-nowrap',
        style,
        className,
      )}
    >
      {children}
    </span>
  )
}
