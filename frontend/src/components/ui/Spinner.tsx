import { cn } from '@/lib/utils/cn'

/**
 * A spinner is decorative: the thing that is loading announces itself
 * (`aria-busy`, or a live region). This element is hidden from assistive
 * technology so it is not read as a stray image.
 */
export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'animate-spin-fast border-brand-line border-t-brand inline-block flex-none rounded-full border-2',
        className,
      )}
      style={{ width: size, height: size }}
    />
  )
}
