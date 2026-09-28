import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * tailwind-merge has to be told about the tokens we named ourselves, or it
 * resolves conflicts wrongly and silently:
 *
 * - **Type scale.** It reads `text-*` by shape: a known t-shirt size is a font
 *   size, anything else is a colour. So `cn('text-meta', 'text-ink')` used to
 *   throw the *size* away.
 * - **Spacing.** It did not recognise `h-control` as a height, so
 *   `cn('h-control', 'h-[50px]')` kept both and the stylesheet's order picked
 *   the winner — the caller's override lost.
 *
 * Colours need no entry: "anything else is a colour" is already right for us.
 * Add a name here whenever a size or spacing token is added to styles/index.css.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      spacing: ['control', 'control-sm', 'control-xs', 'rail', 'rail-open'],
    },
    classGroups: {
      'font-size': [{ text: ['eyebrow', 'micro', 'meta', 'body', 'row', 'lede', 'section'] }],
    },
  },
})

/**
 * Conditional class names, with later Tailwind utilities winning over earlier
 * ones (so a caller's `px-6` beats a component's default `px-4`).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
