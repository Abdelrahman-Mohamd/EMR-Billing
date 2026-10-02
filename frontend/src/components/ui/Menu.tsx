import type { ReactNode } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Check, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/**
 * The overflow menu behind a "More" button: secondary actions that would
 * crowd a row or a toolbar. Radix supplies roving focus, type-ahead and the
 * menu aria roles.
 *
 * Destructive items are marked `danger` so the red is consistent; what counts
 * as destructive is the caller's decision.
 */
export interface MenuItem {
  label: string
  onSelect: () => void
  icon?: ReactNode
  danger?: boolean
  disabled?: boolean
  /** A second, muted line under the label — e.g. a case's insurance and status. */
  description?: string
  /** Marks the current choice when the menu picks between things (a check at the right). */
  selected?: boolean
}

export function Menu({
  items,
  trigger,
  label = 'More actions',
  align = 'end',
  side = 'bottom',
  header,
}: {
  items: ReadonlyArray<MenuItem | 'separator'>
  /** Defaults to an icon button. Pass a Button for a labelled menu. */
  trigger?: ReactNode
  label?: string
  align?: 'start' | 'end'
  /** Where the menu opens from its trigger: below by default, beside it from the rail. */
  side?: 'bottom' | 'right' | 'top'
  /** Non-interactive content above the items — e.g. whose account menu this is. */
  header?: ReactNode
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        {trigger ?? (
          <button
            type="button"
            aria-label={label}
            className="text-n400 hover:bg-n50 hover:text-brand grid size-[30px] place-items-center rounded-sm"
          >
            <MoreHorizontal size={16} aria-hidden="true" />
          </button>
        )}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          side={side}
          sideOffset={6}
          collisionPadding={8}
          className="animate-pop-in rounded-card bg-canvas shadow-popover ring-n200 z-[70] min-w-[220px] p-1.5 ring-1"
        >
          {header !== undefined && (
            <>
              <DropdownMenu.Label className="px-2.5 pt-1.5 pb-2">{header}</DropdownMenu.Label>
              <DropdownMenu.Separator className="bg-rule-row mb-1.5 h-px" />
            </>
          )}
          {items.map((item, index) =>
            item === 'separator' ? (
              <DropdownMenu.Separator key={`sep-${index}`} className="bg-rule-row my-1.5 h-px" />
            ) : (
              <DropdownMenu.Item
                key={item.label}
                disabled={item.disabled ?? false}
                onSelect={item.onSelect}
                className={cn(
                  'text-meta text-n700 flex cursor-pointer items-center gap-2.5 rounded-sm px-2.5 py-2 outline-none',
                  'data-[highlighted]:bg-n50 data-[highlighted]:text-ink',
                  'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-45',
                  item.danger === true &&
                    'text-critical data-[highlighted]:bg-critical-bg data-[highlighted]:text-critical',
                )}
              >
                {item.icon !== undefined && <span className="flex-none">{item.icon}</span>}
                {item.description === undefined ? (
                  item.label
                ) : (
                  <span className="min-w-0 flex-1">
                    <span className="block break-words">{item.label}</span>
                    <span className="text-micro text-n500 block">{item.description}</span>
                  </span>
                )}
                {item.selected === true && (
                  <>
                    <Check size={16} aria-hidden="true" className="text-brand ml-auto flex-none" />
                    <span className="sr-only">(current)</span>
                  </>
                )}
              </DropdownMenu.Item>
            ),
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
