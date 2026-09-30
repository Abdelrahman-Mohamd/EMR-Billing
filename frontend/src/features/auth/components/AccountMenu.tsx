import { useRef, useState } from 'react'
import { ChevronsUpDown, KeyRound, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { toast } from '@/stores/toast-store'
import { Avatar } from '@/components/ui/Avatar'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { Menu } from '@/components/ui/Menu'
import { useCurrentUser, useSignOut } from '../queries/use-current-user'
import { ChangePasswordDialog } from './ChangePasswordDialog'

/**
 * The signed-in person, at the bottom of the rail — or, on a phone, at the
 * right of the top bar — the prototype's account button: their avatar (with their name beside it when the rail is open), and
 * a menu with who they are, Change password and Sign out.
 *
 * It reads who is signed in from `useCurrentUser` only. Until that answers (or
 * if it cannot), the button shows a plain person icon and the menu still
 * offers both actions: changing a password or signing out never depends on
 * having a name to show.
 *
 * Sign out asks first, as the prototype does.
 */
type Open = 'change-password' | 'sign-out' | null

export function AccountMenu({
  expanded,
  placement = 'rail',
}: {
  expanded: boolean
  /** The desktop rail's foot, or the phone's top bar (avatar only, menu below). */
  placement?: 'rail' | 'bar'
}) {
  const inBar = placement === 'bar'
  const user = useCurrentUser()
  const signOut = useSignOut()
  const [open, setOpen] = useState<Open>(null)
  // Dialogs opened from the menu return focus here: the menu item is gone.
  const triggerRef = useRef<HTMLButtonElement>(null)
  const name = user.data?.name
  const email = user.data?.email

  const confirmSignOut = async () => {
    const { confirmed } = await signOut()
    if (confirmed) toast.info('Signed out')
    else {
      toast.warning(
        'Signed out of this browser',
        'The server could not be reached to end the session. Close the browser to be sure.',
      )
    }
  }

  return (
    <>
      <Menu
        label={name === undefined ? 'Account' : `Account: ${name}`}
        side={inBar ? 'bottom' : 'right'}
        align="end"
        {...(user.data === undefined
          ? {}
          : {
              header: (
                <span className="block min-w-0">
                  <span className="text-meta text-ink block font-medium [overflow-wrap:anywhere]">
                    {name}
                  </span>
                  <span className="text-micro text-n500 block font-normal [overflow-wrap:anywhere]">
                    {email}
                  </span>
                </span>
              ),
            })}
        items={[
          {
            label: 'Change password',
            icon: <KeyRound size={16} aria-hidden="true" />,
            onSelect: () => setOpen('change-password'),
          },
          'separator',
          {
            label: 'Sign out',
            icon: <LogOut size={16} aria-hidden="true" />,
            danger: true,
            onSelect: () => setOpen('sign-out'),
          },
        ]}
        trigger={
          <button
            ref={triggerRef}
            type="button"
            aria-label={name === undefined ? 'Account' : `Account: ${name}`}
            // Collapsed, the name shows on hover and focus like the rail's labels.
            data-tip={expanded || inBar ? undefined : (name ?? 'Account')}
            className={cn(
              'flex items-center gap-2.5 rounded-md text-left text-white outline-offset-[-2px] hover:bg-white/10 focus-visible:outline-white',
              inBar
                ? 'size-11 flex-none justify-center'
                : expanded
                  ? 'w-full px-2 py-1.5'
                  : 'nav-tip w-full justify-center py-1.5',
            )}
          >
            <Avatar name={name} />
            {expanded && !inBar && (
              <>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="text-meta block truncate font-medium">{name ?? 'Account'}</span>
                  {email !== undefined && (
                    <span className="text-micro block truncate text-white/70">{email}</span>
                  )}
                </span>
                <ChevronsUpDown size={14} aria-hidden="true" className="flex-none text-white/70" />
              </>
            )}
          </button>
        }
      />

      {open === 'change-password' && (
        <ChangePasswordDialog onClose={() => setOpen(null)} returnFocusTo={triggerRef} />
      )}
      <ConfirmDialog
        open={open === 'sign-out'}
        onOpenChange={(isOpen) => {
          if (!isOpen) setOpen(null)
        }}
        title="Sign out?"
        description="You will return to the sign-in screen."
        confirmLabel="Sign out"
        tone="destructive"
        icon={<LogOut size={20} />}
        onConfirm={confirmSignOut}
        returnFocusTo={triggerRef}
      />
    </>
  )
}
