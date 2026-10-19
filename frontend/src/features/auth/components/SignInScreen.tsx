import { Notice } from '@/components/ui/Notice'
import type { SessionEnd } from '@/lib/auth/session'
import { AuthLayout } from './AuthLayout'
import { SignInForm } from './SignInForm'

/** Why the user is asked to sign in again, when the session ended by itself. */
const ENDED: Readonly<Record<SessionEnd, string>> = {
  rejected: 'Your session has ended. Please sign in again.',
  elsewhere: 'You were signed out in another tab. Please sign in again.',
  'password-changed': 'Your password was changed. Sign in with your new password.',
}

/**
 * The sign-in page: the shared signed-out frame around the sign-in form — and,
 * when the previous session ended without signing out, why (`ended`).
 */
export function SignInScreen({ redirectTo, ended }: { redirectTo: string; ended?: SessionEnd }) {
  return (
    <AuthLayout
      documentTitle="Sign in"
      title={
        <>
          Sign in <span className="text-n500 font-light">to Billing</span>
        </>
      }
      lede="Use your email and password."
    >
      {ended !== undefined && (
        <Notice tone="info" className="mt-6">
          {ENDED[ended]}
        </Notice>
      )}
      <SignInForm redirectTo={redirectTo} />
    </AuthLayout>
  )
}
