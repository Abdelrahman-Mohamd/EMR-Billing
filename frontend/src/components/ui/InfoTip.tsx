import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Info } from 'lucide-react'

/**
 * A small info icon that explains something on demand — the project's pattern
 * for optional context beside a field label (docs/UI_KIT.md § Conventions).
 * `Field` renders it for its `info` prop; use it directly only where there is
 * no Field.
 *
 * - **Mouse:** opens on hover, and stays open while the pointer moves onto the
 *   text, so it can be read and selected (WCAG 1.4.13).
 * - **Keyboard:** the icon is a real button in the tab order; focus opens it,
 *   Escape or leaving closes it.
 * - **Touch:** a tap opens it; tapping elsewhere closes it.
 * - **Screen readers:** the button is named by `label` and described by the
 *   text itself, so the explanation is read with the button whether or not the
 *   bubble is showing.
 *
 * It wears the approved design's only tooltip style — the collapsed rail's
 * label: brand-hover fill, white 14px medium text, a rotated-square pointer
 * and a short fade — so every hint in the product looks the same.
 *
 * The bubble is portalled to the body and flips or shifts to stay on screen,
 * so a dialog, a card or a scroll container never clips it. Built on the Radix
 * popover the kit already ships — no tooltip dependency.
 */
const HIDE_DELAY_MS = 120

export function InfoTip({
  label,
  children,
}: {
  /** The button's name, e.g. "About Tax ID". */
  label: string
  /** The explanation: a sentence or two, plain text. */
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const descriptionId = useId()
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const show = () => {
    clearTimeout(hideTimer.current)
    setOpen(true)
  }
  const hideSoon = () => {
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setOpen(false), HIDE_DELAY_MS)
  }
  // A pending close must not fire after the component is gone.
  useEffect(() => () => clearTimeout(hideTimer.current), [])

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-describedby={descriptionId}
          onPointerEnter={(event) => {
            if (event.pointerType === 'mouse') show()
          }}
          onPointerLeave={(event) => {
            if (event.pointerType === 'mouse') hideSoon()
          }}
          onFocus={show}
          onBlur={hideSoon}
          onClick={(event) => {
            // Opening is hover, focus or tap; a click must not toggle it shut
            // the moment the hover opened it.
            event.preventDefault()
            show()
          }}
          className="text-n500 hover:text-brand data-[state=open]:text-brand relative inline-grid size-4 flex-none place-items-center rounded-full align-middle after:absolute after:-inset-2 after:content-['']"
        >
          <Info size={14} aria-hidden="true" />
        </button>
      </Popover.Trigger>
      {/* Always in the DOM, so the description exists while the bubble is closed. */}
      <span id={descriptionId} hidden>
        {children}
      </span>
      <Popover.Portal>
        <Popover.Content
          role="tooltip"
          side="top"
          align="start"
          sideOffset={8}
          collisionPadding={12}
          // Focus stays on the icon: this is a hint, not a dialog.
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onPointerEnter={show}
          onPointerLeave={hideSoon}
          className="bg-brand-hover text-micro animate-layer-in z-[80] max-w-[min(18rem,calc(100vw-24px))] rounded-md py-1.5 pr-3.5 pl-3 leading-snug font-medium text-white normal-case"
        >
          {children}
          {/* The rail tooltip's pointer: an 8px square turned 45°, half under the bubble. */}
          <Popover.Arrow asChild width={8} height={4}>
            <span className="bg-brand-hover block size-2 -translate-y-1 rotate-45 rounded-[1px]" />
          </Popover.Arrow>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
