import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils/cn'

/**
 * The signed-out pages' secondary actions — "Forgot your password?", "Send a
 * new code", "Change", "Back to sign in" — all look the same: brand text, no
 * box, no padding, so they line up with the fields and the copy instead of
 * floating in button-shaped gaps. Hover darkens the text; there is no
 * underline. `authActionClass` dresses a router `Link` the same way.
 */
export const authActionClass =
  'text-meta text-brand-deep hover:text-ink rounded-sm font-medium no-underline transition-colors disabled:cursor-not-allowed disabled:opacity-55'

export function AuthTextButton({ className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...rest} className={cn(authActionClass, className)} />
}
