import { useRef, useState, type ReactNode, type RefObject } from 'react'
import * as RadixDialog from '@radix-ui/react-dialog'
import { CircleHelp, TriangleAlert, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Button, type ButtonVariant } from './Button'

/**
 * Modal dialog. Radix owns focus trapping, focus restore, Escape, the scroll
 * lock and the aria wiring — the parts that are quietly broken in most
 * hand-rolled dialogs.
 *
 * A dialog is told what to render. It never knows what a claim or a patient
 * is; the feature passes content and handles the action.
 */
export type DialogSize = 'sm' | 'md' | 'lg' | 'xl'

const SIZE: Record<DialogSize, string> = {
  sm: 'sm:max-w-[440px]',
  md: 'sm:max-w-[580px]',
  lg: 'sm:max-w-[880px]',
  xl: 'sm:max-w-[1100px]',
}

export interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /** One or two lines under the title. Always useful; rarely optional in practice. */
  description?: string
  size?: DialogSize
  children: ReactNode
  /** Buttons, right-aligned. Put the primary action last. */
  footer?: ReactNode
  /** Text on the left of the footer — a count, a warning, a record id. */
  footerNote?: ReactNode
  /** Blocks closing by Escape or scrim click — for a dialog with unsaved work. */
  dismissible?: boolean
  /**
   * Where focus goes on close, when what opened the dialog is gone by then —
   * a menu item, for example: point it at the menu's button.
   */
  returnFocusTo?: RefObject<HTMLElement | null>
}

/**
 * Where focus goes when a dialog closes. Radix restores focus to whatever
 * opened it, but a dialog opened from a row menu or a keyboard shortcut can
 * lose that element while it is open; remembering it here — or using the
 * element the caller names — means focus never falls back to the top of the
 * page, which strands a keyboard user.
 */
function useFocusReturn(returnFocusTo: RefObject<HTMLElement | null> | undefined) {
  const opener = useRef<HTMLElement | null>(null)
  return {
    onOpenAutoFocus: () => {
      const active = document.activeElement
      opener.current = active instanceof HTMLElement ? active : null
    },
    onCloseAutoFocus: (event: Event) => {
      const target = returnFocusTo?.current ?? opener.current
      if (target && document.body.contains(target)) {
        event.preventDefault()
        target.focus()
      }
    },
  }
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  size = 'md',
  children,
  footer,
  footerNote,
  dismissible = true,
  returnFocusTo,
}: DialogProps) {
  const focusReturn = useFocusReturn(returnFocusTo)

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="animate-layer-in fixed inset-0 z-[60] bg-[rgba(0,32,46,0.44)]" />
        <RadixDialog.Content
          onOpenAutoFocus={focusReturn.onOpenAutoFocus}
          onCloseAutoFocus={focusReturn.onCloseAutoFocus}
          onEscapeKeyDown={(event) => {
            if (!dismissible) event.preventDefault()
          }}
          onInteractOutside={(event) => {
            if (!dismissible) event.preventDefault()
          }}
          className={cn(
            'animate-dialog-in bg-canvas shadow-dialog fixed inset-x-0 bottom-0 z-[60] flex max-h-[92dvh] flex-col rounded-t-md outline-none',
            'sm:inset-0 sm:m-auto sm:h-fit sm:max-h-[calc(100dvh-48px)] sm:rounded-md',
            SIZE[size],
          )}
        >
          <div className="flex items-start gap-4 px-4 pt-5 pb-4 shadow-[inset_0_-1px_0_var(--color-rule-structural)] sm:px-6">
            <div className="min-w-0 flex-1">
              <RadixDialog.Title className="text-ink text-[22px] leading-tight font-normal">
                {title}
              </RadixDialog.Title>
              {description !== undefined && (
                <RadixDialog.Description className="text-meta text-n600 mt-1.5 leading-relaxed">
                  {description}
                </RadixDialog.Description>
              )}
            </div>
            {dismissible && (
              <RadixDialog.Close
                aria-label="Close"
                className="text-n400 hover:bg-n50 hover:text-ink -mt-1 -mr-1 grid size-10 flex-none place-items-center rounded-md sm:mt-0 sm:mr-0 sm:size-8 sm:rounded-sm"
              >
                <X size={18} aria-hidden="true" />
              </RadixDialog.Close>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">{children}</div>

          {(footer !== undefined || footerNote !== undefined) && (
            <div
              className={cn(
                'flex flex-col-reverse gap-2 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[inset_0_1px_0_var(--color-rule-structural)]',
                // A phone stacks the buttons full width, the primary one (last)
                // on top where the thumb is; wider, they sit side by side.
                '*:w-full sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-2.5 sm:px-6 sm:pt-4 sm:pb-5 sm:*:w-auto',
              )}
            >
              {footerNote !== undefined && (
                <span className="text-micro text-n500 text-center sm:mr-auto sm:text-left">{footerNote}</span>
              )}
              {footer}
            </div>
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}

/** Closes the dialog it is inside. */
export const DialogClose = RadixDialog.Close

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel: string
  cancelLabel?: string
  /** Destructive confirmations get the filled red button and a red icon. */
  tone?: 'default' | 'destructive'
  /**
   * A 20px icon for what is being confirmed (sign out, deactivate …).
   * Defaults to a warning sign for a destructive confirmation, a question
   * mark otherwise.
   */
  icon?: ReactNode
  /** May be async: the button shows a busy state until it settles. */
  onConfirm: () => void | Promise<void>
  /** Rarely needed: something the decision depends on, under the description. */
  children?: ReactNode
  /** See Dialog. */
  returnFocusTo?: RefObject<HTMLElement | null>
}

/**
 * The confirmation every consequential action needs — sign out, deactivate,
 * release, void. Its own compact layout, not a Dialog with an empty body: an
 * icon, the question, one line of context, and two buttons.
 *
 * - It is an `alertdialog`, so a screen reader announces it as an
 *   interruption and reads the question and its context.
 * - Focus starts on **Cancel**: pressing Enter by reflex must not do the
 *   irreversible thing.
 * - On a phone the buttons stack full width, the action on top.
 * - No close button: Cancel and Escape already say "no".
 *
 * The wording is the caller's: this component must not invent a sentence
 * about money or records.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'default',
  icon,
  onConfirm,
  children,
  returnFocusTo,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false)
  const focusReturn = useFocusReturn(returnFocusTo)
  const destructive = tone === 'destructive'
  const confirmVariant: ButtonVariant = destructive ? 'dangerFill' : 'primary'

  const handleConfirm = () => {
    const result = onConfirm()
    if (!(result instanceof Promise)) {
      onOpenChange(false)
      return
    }
    setBusy(true)
    void result.then(() => onOpenChange(false)).finally(() => setBusy(false))
  }

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="animate-layer-in fixed inset-0 z-[60] bg-[rgba(0,32,46,0.44)]" />
        <RadixDialog.Content
          role="alertdialog"
          onOpenAutoFocus={focusReturn.onOpenAutoFocus}
          onCloseAutoFocus={focusReturn.onCloseAutoFocus}
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault()
          }}
          onInteractOutside={(event) => {
            if (busy) event.preventDefault()
          }}
          className="animate-dialog-in bg-canvas shadow-dialog rounded-card fixed inset-0 z-[60] m-auto h-fit w-[calc(100%-32px)] max-w-[440px] p-6 outline-none"
        >
          <div className="flex items-start gap-4">
            <span
              aria-hidden="true"
              className={cn(
                'grid size-10 flex-none place-items-center rounded-full',
                destructive ? 'bg-critical-bg text-critical' : 'bg-brand-wash text-brand-deep',
              )}
            >
              {icon ?? (destructive ? <TriangleAlert size={20} /> : <CircleHelp size={20} />)}
            </span>
            <div className="min-w-0 flex-1 pt-1.5">
              <RadixDialog.Title className="text-lede text-ink leading-snug font-normal [overflow-wrap:anywhere]">
                {title}
              </RadixDialog.Title>
              {description !== undefined && (
                <RadixDialog.Description className="text-meta text-n600 mt-1.5 leading-relaxed">
                  {description}
                </RadixDialog.Description>
              )}
              {children !== undefined && <div className="mt-3">{children}</div>}
            </div>
          </div>

          {/* Cancel first in the document, so it takes focus; shown second on a
              phone (stacked under the action) and first on a wider screen. */}
          <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
            <Button onClick={() => onOpenChange(false)} disabled={busy} className="w-full sm:w-auto">
              {cancelLabel}
            </Button>
            <Button
              variant={confirmVariant}
              onClick={handleConfirm}
              loading={busy}
              className="w-full sm:w-auto"
            >
              {confirmLabel}
            </Button>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}
