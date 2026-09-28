import type { ReactNode } from 'react'
import * as RadixDialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/**
 * A side panel for detail that belongs beside a list rather than on its own
 * screen — the pattern the approved prototype uses for a run, a batch, a
 * history trail.
 *
 * Same machinery as Dialog (focus trap, Escape, restore). The difference is
 * only where it comes from and that it is wider than tall.
 */
export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  width = 'md',
  footer,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  width?: 'md' | 'lg'
  footer?: ReactNode
  children: ReactNode
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="animate-layer-in fixed inset-0 z-[55] bg-[rgba(18,21,31,0.34)]" />
        <RadixDialog.Content
          className={cn(
            'animate-drawer-in bg-canvas shadow-drawer fixed inset-y-0 right-0 z-[55] flex w-full flex-col outline-none',
            width === 'lg' ? 'sm:w-[720px]' : 'sm:w-[520px]',
          )}
        >
          <div className="border-rule-structural flex items-start gap-4 border-b px-6 pt-5 pb-4">
            <div className="min-w-0 flex-1">
              <RadixDialog.Title className="text-lede text-ink leading-tight font-medium">
                {title}
              </RadixDialog.Title>
              {description !== undefined && (
                <RadixDialog.Description className="text-meta text-n600 mt-1">
                  {description}
                </RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close
              aria-label="Close"
              className="text-n400 hover:bg-n50 hover:text-ink grid size-8 flex-none place-items-center rounded-sm"
            >
              <X size={16} aria-hidden="true" />
            </RadixDialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer !== undefined && (
            <div className="border-rule-structural flex flex-wrap items-center justify-end gap-2.5 border-t px-6 py-4">
              {footer}
            </div>
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}
