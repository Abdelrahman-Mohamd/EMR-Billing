import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input, type InputProps } from '@/components/ui/Input'

/**
 * A password field with a show/hide control. Seeing what you typed is the
 * single most effective way to stop failed sign-ins from typos, and it matters
 * most on a phone keyboard.
 *
 * The toggle keeps one accessible name — "Show password" — and reports its
 * state with `aria-pressed`, which is how a toggle button is meant to work;
 * swapping the label between "Show" and "Hide" as well would announce the
 * state twice.
 *
 * Used by sign-in, change / reset password and Admin → Users. It never takes
 * a stored password as its value: a password field starts empty.
 */
export function PasswordInput(props: Omit<InputProps, 'type' | 'suffix'>) {
  const [visible, setVisible] = useState(false)
  return (
    <Input
      {...props}
      type={visible ? 'text' : 'password'}
      suffix={
        <button
          type="button"
          aria-label="Show password"
          aria-pressed={visible}
          onClick={() => setVisible((shown) => !shown)}
          className="text-n500 hover:bg-n50 hover:text-ink -mr-1.5 grid size-8 place-items-center rounded-sm"
        >
          {visible ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
        </button>
      }
    />
  )
}
