import { UserRound } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/**
 * A person as a small circle: their picture when there is one, otherwise the
 * initials of their name (the prototype's avatar — "Ahmed" → A, "Ahmed
 * Mohamed" → AM), otherwise a person icon. Decorative: the name is always
 * said by the control or text around it, so the circle itself is hidden from
 * assistive technology.
 */
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
}

const SIZE = { sm: 'size-7 text-[11px]', md: 'size-8 text-[13px]' } as const

export function Avatar({
  name,
  src,
  size = 'md',
  className,
}: {
  name?: string | undefined
  /** A picture URL, when the data has one. */
  src?: string | undefined
  size?: keyof typeof SIZE
  className?: string
}) {
  const initials = name === undefined ? '' : initialsOf(name)
  return (
    <span
      aria-hidden="true"
      className={cn(
        // The prototype's avatar: white, brand-coloured initials, semibold.
        'bg-canvas text-brand grid flex-none place-items-center overflow-hidden rounded-full font-semibold',
        SIZE[size],
        className,
      )}
    >
      {src !== undefined ? (
        <img src={src} alt="" className="size-full object-cover" />
      ) : initials !== '' ? (
        initials
      ) : (
        <UserRound size={size === 'sm' ? 14 : 16} />
      )}
    </span>
  )
}
