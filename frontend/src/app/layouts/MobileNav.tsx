import { useState, type ReactNode } from 'react'
import * as RadixDialog from '@radix-ui/react-dialog'
import { Link } from '@tanstack/react-router'
import { Menu as MenuIcon, X } from 'lucide-react'
import logoUrl from '@/assets/logo.png'
import { RailLink, type NavGroup } from './RailLink'

/**
 * The phone's chrome, below 768px, as the approved prototype has it: a brand
 * bar across the top — menu button, logo, the account — and the rail as a
 * drawer that slides in from the left over a scrim.
 *
 * The drawer lists the same navigation as the desktop rail (the same
 * `NavGroup`s), always open, with each module's sub-sections under it — the
 * Admin sections, which the desktop shows in their own list. Following a link
 * closes it; so do the close button, Escape and a tap on the scrim. Radix
 * traps focus inside while it is open and returns it to the menu button.
 */
export function MobileBar({
  groups,
  account,
}: {
  groups: readonly NavGroup[]
  /** The account button, laid out for the bar. */
  account?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <RadixDialog.Root open={open} onOpenChange={setOpen}>
      <header className="bg-brand relative z-30 flex h-14 flex-none items-center gap-1 px-2">
        <RadixDialog.Trigger
          aria-label="Open navigation menu"
          className="grid size-11 flex-none place-items-center rounded-md text-white/90 outline-offset-[-2px] hover:bg-white/10 focus-visible:outline-white"
        >
          <MenuIcon size={22} aria-hidden="true" />
        </RadixDialog.Trigger>
        <Link
          to="/"
          aria-label="EMR Billing — home"
          className="flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 outline-offset-[-2px] focus-visible:outline-white"
        >
          <img src={logoUrl} alt="" className="h-6 w-auto flex-none brightness-0 invert" />
          <span className="text-meta leading-none font-medium text-white/85">Billing</span>
        </Link>
        <span className="flex-1" />
        {account}
      </header>

      <RadixDialog.Portal>
        <RadixDialog.Overlay className="animate-layer-in fixed inset-0 z-[55] bg-[rgba(0,32,46,0.44)]" />
        <RadixDialog.Content
          aria-describedby={undefined}
          className="animate-drawer-in-left bg-brand shadow-drawer fixed inset-y-0 left-0 z-[55] flex w-[min(300px,85vw)] flex-col p-3 outline-none"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <RadixDialog.Title className="sr-only">Navigation menu</RadixDialog.Title>
            <Link
              to="/"
              onClick={close}
              aria-label="EMR Billing — home"
              className="flex flex-col items-start gap-0.5 rounded-md py-2 outline-offset-[-2px] focus-visible:outline-white"
            >
              <img src={logoUrl} alt="" className="h-auto w-24 brightness-0 invert" />
              <span className="text-[14px] leading-none font-medium tracking-wide text-white/85">
                Billing
              </span>
            </Link>
            <RadixDialog.Close
              aria-label="Close navigation menu"
              className="grid size-11 flex-none place-items-center rounded-md text-white/90 outline-offset-[-2px] hover:bg-white/10 focus-visible:outline-white"
            >
              <X size={20} aria-hidden="true" />
            </RadixDialog.Close>
          </div>

          <nav aria-label="Main" className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
            {groups.map((group, index) => (
              <div key={group.label ?? index} className="flex flex-col gap-1">
                {group.label !== undefined && (
                  <p className="text-eyebrow mt-3 px-3 pb-1 font-medium text-white/45 uppercase">
                    {group.label}
                  </p>
                )}
                {group.items.map((item) => (
                  <div key={item.label} className="flex flex-col gap-0.5">
                    <RailLink item={item} expanded onNavigate={close} />
                    {item.children?.map((child) => (
                      <RailLink key={child.label} item={child} expanded nested onNavigate={close} />
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </nav>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}
